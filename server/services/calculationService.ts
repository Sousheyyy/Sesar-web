import { PrismaClient } from '@prisma/client';

// Types for method returns
export interface ApproximateEarnings {
    approximateEarningsTL: number;
    approximateSharePercent: number;
    confirmedEarningsTL: number;
    confirmedSharePercent: number;
    lastUpdatedAt: Date | null;
    isApproximate: boolean;
}

export interface InsuranceCheckResult {
    passed: boolean;
    failedChecks: string[];
}

export interface DistributionResult {
    campaignId: string;
    type: 'DISTRIBUTED' | 'INSURANCE_REFUND' | 'INSURANCE_REFUND_NO_ELIGIBLE';
    refundAmount?: number;
    netBudgetTL?: number;
    totalPayouts?: number;
    failedChecks?: string[];
    payouts?: Array<{ submissionId: string; creatorId: string; earningsTL: number }>;
}

/**
 * Calculation Service
 *
 * Centralized service for all campaign and submission calculations.
 * This is the SINGLE SOURCE OF TRUTH for all calculation logic.
 */
export class CalculationService {
    // --- Point multipliers ---
    private static readonly VIEW_POINT_MULTIPLIER = 0.01;
    private static readonly LIKE_POINT_MULTIPLIER = 0.5;
    private static readonly SHARE_POINT_MULTIPLIER = 1.0;

    // --- Robin Hood ---
    private static readonly MAX_SHARE_PERCENT = 0.40;
    private static readonly MAX_CAPPED_USERS = 2;

    // --- Eligibility thresholds (must meet BOTH) ---
    static readonly MIN_ELIGIBLE_POINTS = 50;
    static readonly MIN_ELIGIBLE_CONTRIBUTION = 0.001; // 0.1%

    // --- Insurance thresholds by budget bracket (must meet ALL THREE for normal distribution) ---
    static getInsuranceThresholds(totalBudget: number): { minSubmissions: number; minPoints: number; minViews: number } {
        if (totalBudget >= 100000) return { minSubmissions: 15, minPoints: 15_000, minViews: 1_500_000 };
        if (totalBudget >= 70000)  return { minSubmissions: 8,  minPoints: 5_000,  minViews: 500_000 };
        if (totalBudget >= 40000)  return { minSubmissions: 5,  minPoints: 2_000,  minViews: 200_000 };
        return { minSubmissions: 3, minPoints: 500, minViews: 50_000 };
    }

    // --- Refund percentages ---
    // Insurance refund = 100% of net budget (prize pool after commission). Commission is always kept.
    static readonly ARTIST_CANCEL_REFUND_PERCENT = 1.00;
    static readonly ADMIN_REJECT_REFUND_PERCENT = 1.00;

    // =========================================================================
    // PURE CALCULATION METHODS (no DB access)
    // =========================================================================

    /**
     * Calculate points from engagement metrics
     */
    static calculatePoints(views: number, likes: number, shares: number) {
        const viewPoints = views * this.VIEW_POINT_MULTIPLIER;
        const likePoints = likes * this.LIKE_POINT_MULTIPLIER;
        const sharePoints = shares * this.SHARE_POINT_MULTIPLIER;
        const totalPoints = viewPoints + likePoints + sharePoints;

        return { viewPoints, likePoints, sharePoints, totalPoints };
    }

    /**
     * Calculate share percentage with Robin Hood cap
     */
    static calculateSharePercent(
        myPoints: number,
        totalCampaignPoints: number
    ): number {
        if (totalCampaignPoints === 0 || myPoints === 0) return 0;

        let sharePercent = myPoints / totalCampaignPoints;

        if (sharePercent > this.MAX_SHARE_PERCENT) {
            sharePercent = this.MAX_SHARE_PERCENT;
        }

        return sharePercent;
    }

    /**
     * Calculate net budget after commission (returns TL)
     */
    static calculateNetBudget(
        totalBudget: number,
        commissionPercent: number
    ) {
        const netMultiplier = (100 - commissionPercent) / 100;
        const netBudgetTL = totalBudget * netMultiplier;

        return { netBudgetTL, netMultiplier };
    }

    /**
     * Check insurance thresholds based on campaign budget
     */
    static checkInsuranceThresholds(
        totalBudget: number,
        totalSubmissions: number,
        totalPoints: number,
        totalViews: number
    ): InsuranceCheckResult {
        const thresholds = this.getInsuranceThresholds(totalBudget);

        const failedChecks: string[] = [];

        if (totalSubmissions < thresholds.minSubmissions) {
            failedChecks.push(`Submissions: ${totalSubmissions}/${thresholds.minSubmissions}`);
        }
        if (totalPoints < thresholds.minPoints) {
            failedChecks.push(`Points: ${totalPoints.toFixed(0)}/${thresholds.minPoints}`);
        }
        if (totalViews < thresholds.minViews) {
            failedChecks.push(`Views: ${totalViews}/${thresholds.minViews.toLocaleString()}`);
        }

        return { passed: failedChecks.length === 0, failedChecks };
    }

    /**
     * Filter submissions that meet eligibility thresholds
     */
    static filterEligibleSubmissions<T extends { id: string; totalPoints: number }>(
        submissions: T[],
        totalCampaignPoints: number
    ): T[] {
        if (totalCampaignPoints === 0) return [];

        return submissions.filter(sub => {
            const points = sub.totalPoints || 0;
            const contribution = points / totalCampaignPoints;

            return points >= this.MIN_ELIGIBLE_POINTS
                && contribution >= this.MIN_ELIGIBLE_CONTRIBUTION;
        });
    }

    /**
     * Calculate approximate earnings for a submission (server-side, on-read).
     * No Robin Hood — just raw proportional share for speed.
     */
    static calculateApproximateEarnings(
        submission: { totalPoints: number; estimatedEarnings: any; sharePercent: number },
        poolStats: { lastBatchTotalPoints: number; lastBatchAt: Date | null; totalCampaignPoints: number },
        campaign: { totalBudget: any; commissionPercent: number }
    ): ApproximateEarnings {
        const { netBudgetTL } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.commissionPercent
        );

        const currentTotal = poolStats.totalCampaignPoints;

        if (currentTotal === 0 || (submission.totalPoints || 0) === 0) {
            return {
                approximateEarningsTL: 0,
                approximateSharePercent: 0,
                confirmedEarningsTL: Number(submission.estimatedEarnings) || 0,
                confirmedSharePercent: submission.sharePercent || 0,
                lastUpdatedAt: poolStats.lastBatchAt,
                isApproximate: true,
            };
        }

        const rawShare = submission.totalPoints / currentTotal;
        const approximateEarningsTL = Math.round(netBudgetTL * rawShare * 100) / 100;
        const approximateSharePercent = Math.round(rawShare * 10000) / 100;

        return {
            approximateEarningsTL,
            approximateSharePercent,
            confirmedEarningsTL: Number(submission.estimatedEarnings) || 0,
            confirmedSharePercent: submission.sharePercent || 0,
            lastUpdatedAt: poolStats.lastBatchAt,
            isApproximate: poolStats.lastBatchAt !== null,
        };
    }

    /**
     * Run Robin Hood redistribution on a set of submissions.
     * Pure logic — returns computed shares, does NOT write to DB.
     */
    static computeRobinHoodShares(
        submissions: Array<{ id: string; totalPoints: number }>,
        totalCampaignPoints: number,
        netBudgetTL: number
    ): Array<{ id: string; sharePercent: number; earningsTL: number }> {
        if (submissions.length === 0 || totalCampaignPoints === 0) return [];

        let working = submissions.map(sub => ({
            id: sub.id,
            points: sub.totalPoints || 0,
            sharePercent: (sub.totalPoints || 0) / totalCampaignPoints,
            isCapped: false,
        }));

        let iterations = 0;
        const MAX_ITERATIONS = 10;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const cappedCount = working.filter(sub => sub.isCapped).length;
            let hasNewCaps = false;

            for (const sub of working) {
                if (!sub.isCapped && sub.sharePercent > this.MAX_SHARE_PERCENT) {
                    if (cappedCount < this.MAX_CAPPED_USERS) {
                        sub.sharePercent = this.MAX_SHARE_PERCENT;
                    } else {
                        sub.sharePercent = this.MAX_SHARE_PERCENT - 0.0001; // 39.99%
                    }
                    sub.isCapped = true;
                    hasNewCaps = true;
                }
            }

            const currentTotal = working.reduce((sum, sub) => sum + sub.sharePercent, 0);

            if (Math.abs(currentTotal - 1.0) < 0.0001) break;

            if (currentTotal < 1.0) {
                const excess = 1.0 - currentTotal;
                const uncapped = working.filter(sub => !sub.isCapped);

                if (uncapped.length === 0) {
                    const perSubmission = excess / working.length;
                    for (const sub of working) {
                        sub.sharePercent += perSubmission;
                    }
                    break;
                } else {
                    const uncappedTotal = uncapped.reduce((sum, sub) => sum + sub.sharePercent, 0);
                    for (const sub of working) {
                        if (!sub.isCapped && uncappedTotal > 0) {
                            sub.sharePercent += (sub.sharePercent / uncappedTotal) * excess;
                        }
                    }
                }
            } else {
                break;
            }

            if (!hasNewCaps) break;
        }

        return working.map(sub => ({
            id: sub.id,
            sharePercent: sub.sharePercent,
            earningsTL: Math.round(netBudgetTL * sub.sharePercent * 100) / 100,
        }));
    }

    // =========================================================================
    // DATABASE METHODS
    // =========================================================================

    /**
     * Update a single submission's points (no share recalc)
     */
    static async updateSubmissionCalculations(
        submissionId: string,
        prisma: PrismaClient,
        tx?: any
    ) {
        const db = tx || prisma;

        const submission = await db.submission.findUnique({
            where: { id: submissionId },
            include: { campaign: { include: { poolStats: true } } },
        });

        if (!submission) throw new Error('Submission not found');

        const points = this.calculatePoints(
            submission.lastViewCount || 0,
            submission.lastLikeCount || 0,
            submission.lastShareCount || 0
        );

        await db.submission.update({
            where: { id: submissionId },
            data: {
                viewPoints: points.viewPoints,
                likePoints: points.likePoints,
                sharePoints: points.sharePoints,
                totalPoints: points.totalPoints,
            },
        });

        return { points };
    }

    /**
     * Update campaign aggregate totals (cheap operation)
     */
    static async updateCampaignTotalPoints(
        campaignId: string,
        prisma: PrismaClient,
        tx?: any
    ) {
        const db = tx || prisma;

        const agg = await db.submission.aggregate({
            where: { campaignId, status: 'APPROVED' },
            _sum: { totalPoints: true, lastViewCount: true },
            _count: true,
        });

        const totalCampaignPoints = agg._sum.totalPoints || 0;
        const totalSubmissions = agg._count;
        const averagePoints = totalSubmissions > 0 ? totalCampaignPoints / totalSubmissions : 0;

        await db.campaignPoolStats.upsert({
            where: { campaignId },
            create: { campaignId, totalCampaignPoints, totalSubmissions, averagePoints },
            update: { totalCampaignPoints, totalSubmissions, averagePoints },
        });

        await db.campaign.update({
            where: { id: campaignId },
            data: { totalCampaignPoints },
        });

        return { totalCampaignPoints, totalSubmissions, averagePoints, totalViews: agg._sum.lastViewCount || 0 };
    }

    /**
     * Recalculate all submissions for a campaign with Robin Hood redistribution.
     * Optionally accepts a pre-filtered list of eligible submissions for final distribution.
     */
    static async recalculateCampaignSubmissions(
        campaignId: string,
        prisma: PrismaClient,
        tx?: any,
        eligibleSubmissionIds?: string[]
    ) {
        const db = tx || prisma;

        const campaign = await db.campaign.findUnique({
            where: { id: campaignId },
            include: {
                poolStats: true,
                submissions: { where: { status: 'APPROVED' } },
            },
        });

        if (!campaign) return { recalculated: 0 };

        const allSubmissions = campaign.submissions;
        if (allSubmissions.length === 0) return { recalculated: 0 };

        const totalCampaignPoints = campaign.poolStats?.totalCampaignPoints || 0;
        if (totalCampaignPoints === 0) return { recalculated: 0 };

        const { netBudgetTL } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.commissionPercent
        );

        // If eligibleSubmissionIds provided, only those participate in Robin Hood
        const participatingSubmissions = eligibleSubmissionIds
            ? allSubmissions.filter((s: any) => eligibleSubmissionIds.includes(s.id))
            : allSubmissions;

        // Calculate total points for PARTICIPATING submissions only
        const participatingTotalPoints = participatingSubmissions.reduce(
            (sum: number, s: any) => sum + (s.totalPoints || 0), 0
        );

        if (participatingTotalPoints === 0) return { recalculated: 0 };

        // Run Robin Hood on participating submissions
        const shares = this.computeRobinHoodShares(
            participatingSubmissions.map((s: any) => ({ id: s.id, totalPoints: s.totalPoints || 0 })),
            participatingTotalPoints,
            netBudgetTL
        );

        // Update participating submissions with final shares
        for (const share of shares) {
            await db.submission.update({
                where: { id: share.id },
                data: {
                    sharePercent: share.sharePercent,
                    estimatedEarnings: share.earningsTL,
                    totalEarnings: share.earningsTL,
                },
            });
        }

        // Zero out non-participating submissions (ineligible)
        if (eligibleSubmissionIds) {
            const ineligibleIds = allSubmissions
                .filter((s: any) => !eligibleSubmissionIds.includes(s.id))
                .map((s: any) => s.id);

            if (ineligibleIds.length > 0) {
                await db.submission.updateMany({
                    where: { id: { in: ineligibleIds } },
                    data: { sharePercent: 0, estimatedEarnings: 0, totalEarnings: 0 },
                });
            }
        }

        // Update batch tracking
        await db.campaignPoolStats.update({
            where: { campaignId },
            data: { lastBatchAt: new Date(), lastBatchTotalPoints: totalCampaignPoints },
        });

        return { recalculated: shares.length };
    }

    /**
     * Process final distribution for a completed campaign.
     * Handles: insurance check → eligibility filter → Robin Hood → wallet payouts.
     */
    static async processFinalDistribution(
        campaignId: string,
        prisma: PrismaClient
    ): Promise<DistributionResult> {
        return await prisma.$transaction(async (tx: any) => {
            const campaign = await tx.campaign.findUnique({
                where: { id: campaignId },
                include: {
                    submissions: { where: { status: 'APPROVED' } },
                    poolStats: true,
                },
            });

            if (!campaign) throw new Error('Campaign not found');

            // 1. Final point aggregation
            const stats = await this.updateCampaignTotalPoints(campaignId, prisma, tx);

            // 2. Insurance check (budget-based thresholds)
            const insuranceResult = this.checkInsuranceThresholds(
                Number(campaign.totalBudget),
                stats.totalSubmissions,
                stats.totalCampaignPoints,
                stats.totalViews
            );

            if (!insuranceResult.passed) {
                return await this._processInsuranceRefund(
                    tx, campaign, campaignId,
                    insuranceResult.failedChecks,
                    { totalSubmissions: stats.totalSubmissions, totalPoints: stats.totalCampaignPoints, totalViews: stats.totalViews }
                );
            }

            // 3. Eligibility filter
            const eligible = this.filterEligibleSubmissions(
                campaign.submissions.map((s: any) => ({ id: s.id, totalPoints: s.totalPoints || 0 })),
                stats.totalCampaignPoints
            );

            if (eligible.length === 0) {
                return await this._processInsuranceRefund(
                    tx, campaign, campaignId,
                    ['No eligible submissions after threshold filter'],
                    { totalSubmissions: stats.totalSubmissions, totalPoints: stats.totalCampaignPoints, totalViews: stats.totalViews }
                );
            }

            // 4. Robin Hood distribution on eligible submissions
            const eligibleIds = eligible.map(e => e.id);
            await this.recalculateCampaignSubmissions(campaignId, prisma, tx, eligibleIds);

            // 5. Wallet distribution
            const { netBudgetTL } = this.calculateNetBudget(
                Number(campaign.totalBudget),
                campaign.commissionPercent
            );

            const payouts: Array<{ submissionId: string; creatorId: string; earningsTL: number }> = [];

            for (const sub of campaign.submissions) {
                if (!eligibleIds.includes(sub.id)) continue;

                const updated = await tx.submission.findUnique({ where: { id: sub.id } });
                if (!updated || Number(updated.estimatedEarnings) <= 0) continue;

                const earningsTL = Number(updated.estimatedEarnings);

                await tx.user.update({
                    where: { id: sub.creatorId },
                    data: { balance: { increment: earningsTL } },
                });

                await tx.transaction.create({
                    data: {
                        userId: sub.creatorId,
                        type: 'EARNING',
                        amount: earningsTL,
                        status: 'COMPLETED',
                        description: `Campaign earnings: ${campaign.title}`,
                        reference: sub.id,
                    },
                });

                payouts.push({ submissionId: sub.id, creatorId: sub.creatorId, earningsTL });
            }

            // 6. Mark campaign complete
            await tx.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'COMPLETED',
                    payoutStatus: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            await tx.metricFetchLog.create({
                data: {
                    campaignId,
                    source: 'FINAL',
                    status: 'SUCCESS',
                    metricsSnapshot: {
                        totalSubmissions: stats.totalSubmissions,
                        eligibleSubmissions: eligible.length,
                        totalPoints: stats.totalCampaignPoints,
                        totalViews: stats.totalViews,
                        netBudgetTL,
                        payoutsCount: payouts.length,
                    },
                },
            });

            return {
                campaignId,
                type: 'DISTRIBUTED' as const,
                netBudgetTL,
                totalPayouts: payouts.length,
                payouts,
            };
        }, { timeout: 60000 });
    }

    /**
     * Internal: process an insurance refund within a transaction
     */
    private static async _processInsuranceRefund(
        tx: any,
        campaign: any,
        campaignId: string,
        failedChecks: string[],
        metrics: { totalSubmissions: number; totalPoints: number; totalViews: number }
    ): Promise<DistributionResult> {
        // Refund = 100% of net budget (prize pool). Commission is always kept by the platform.
        const { netBudgetTL } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.commissionPercent
        );
        const refundAmount = Math.round(netBudgetTL * 100) / 100;

        await tx.user.update({
            where: { id: campaign.artistId },
            data: { balance: { increment: refundAmount } },
        });

        await tx.transaction.create({
            data: {
                userId: campaign.artistId,
                type: 'DEPOSIT',
                amount: refundAmount,
                status: 'COMPLETED',
                description: `Insurance refund: ${campaign.title} (${failedChecks.join(', ')})`,
            },
        });

        await tx.campaign.update({
            where: { id: campaignId },
            data: {
                status: 'COMPLETED',
                payoutStatus: 'COMPLETED',
                completedAt: new Date(),
                insuranceTriggered: true,
            },
        });

        await tx.metricFetchLog.create({
            data: {
                campaignId,
                source: 'FINAL',
                status: 'INSURANCE_TRIGGERED',
                metricsSnapshot: { ...metrics, failedChecks },
            },
        });

        return {
            campaignId,
            type: 'INSURANCE_REFUND',
            refundAmount,
            failedChecks,
        };
    }

    /**
     * Initialize campaign calculations (call when campaign is created)
     */
    static async initializeCampaign(
        campaignId: string,
        prisma: PrismaClient
    ) {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
        });

        if (!campaign) throw new Error('Campaign not found');

        const { netMultiplier } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.commissionPercent
        );

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { netMultiplier, totalCampaignPoints: 0 },
        });

        await prisma.campaignPoolStats.create({
            data: {
                campaignId,
                totalCampaignPoints: 0,
                totalSubmissions: 0,
                averagePoints: 0,
            },
        });

        return { netMultiplier };
    }
}
