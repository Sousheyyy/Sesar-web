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
    type: 'DISTRIBUTED' | 'INSURANCE_REFUND' | 'INSURANCE_REFUND_NO_ELIGIBLE' | 'ALREADY_PROCESSED';
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
 * Views-only system — no weighted points. Contribution = raw view counts.
 */
export class CalculationService {
    // --- Robin Hood ---
    private static readonly MAX_SHARE_PERCENT = 0.40;
    private static readonly MAX_CAPPED_USERS = 2;

    // --- Eligibility: must have at least 0.01% of total views ---
    static readonly MIN_ELIGIBLE_CONTRIBUTION = 0.0001; // 0.01%

    // --- Max submissions per creator per campaign ---
    static readonly MAX_SUBMISSIONS_PER_CREATOR = 10;

    // --- Insurance thresholds by budget bracket (must meet BOTH for normal distribution) ---
    static getInsuranceThresholds(totalBudget: number): { minSubmissions: number; minViews: number } {
        if (totalBudget >= 100000) return { minSubmissions: 15, minViews: 1_500_000 };
        if (totalBudget >= 70000)  return { minSubmissions: 8,  minViews: 500_000 };
        if (totalBudget >= 40000)  return { minSubmissions: 5,  minViews: 200_000 };
        return { minSubmissions: 3, minViews: 50_000 };
    }

    // =========================================================================
    // PURE CALCULATION METHODS (no DB access)
    // =========================================================================

    /**
     * Calculate share percentage with Robin Hood cap
     */
    static calculateSharePercent(
        myViews: number,
        totalCampaignViews: number
    ): number {
        if (totalCampaignViews === 0 || myViews === 0) return 0;

        let sharePercent = myViews / totalCampaignViews;

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
        totalViews: number
    ): InsuranceCheckResult {
        const thresholds = this.getInsuranceThresholds(totalBudget);

        const failedChecks: string[] = [];

        if (totalSubmissions < thresholds.minSubmissions) {
            failedChecks.push(`Submissions: ${totalSubmissions}/${thresholds.minSubmissions}`);
        }
        if (totalViews < thresholds.minViews) {
            failedChecks.push(`Views: ${totalViews}/${thresholds.minViews.toLocaleString()}`);
        }

        return { passed: failedChecks.length === 0, failedChecks };
    }

    /**
     * Filter submissions that meet eligibility threshold (0.01% of total views)
     */
    static filterEligibleSubmissions<T extends { id: string; lastViewCount: number }>(
        submissions: T[],
        totalCampaignViews: number
    ): T[] {
        if (totalCampaignViews === 0) return [];

        return submissions.filter(sub => {
            const views = sub.lastViewCount || 0;
            const contribution = views / totalCampaignViews;

            return contribution >= this.MIN_ELIGIBLE_CONTRIBUTION;
        });
    }

    /**
     * Calculate approximate earnings for a submission (server-side, on-read).
     * No Robin Hood — just raw proportional share for speed.
     */
    static calculateApproximateEarnings(
        submission: { lastViewCount: number; estimatedEarnings: any; sharePercent: number },
        totalCampaignViews: number,
        campaign: { totalBudget: any; commissionPercent: number }
    ): ApproximateEarnings {
        const { netBudgetTL } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.commissionPercent
        );

        if (totalCampaignViews === 0 || (submission.lastViewCount || 0) === 0) {
            return {
                approximateEarningsTL: 0,
                approximateSharePercent: 0,
                confirmedEarningsTL: Number(submission.estimatedEarnings) || 0,
                confirmedSharePercent: submission.sharePercent || 0,
                lastUpdatedAt: null,
                isApproximate: true,
            };
        }

        const rawShare = Math.min(submission.lastViewCount / totalCampaignViews, this.MAX_SHARE_PERCENT);
        const approximateEarningsTL = Math.round(netBudgetTL * rawShare * 100) / 100;
        const approximateSharePercent = Math.round(rawShare * 10000) / 100;

        return {
            approximateEarningsTL,
            approximateSharePercent,
            confirmedEarningsTL: Number(submission.estimatedEarnings) || 0,
            confirmedSharePercent: submission.sharePercent || 0,
            lastUpdatedAt: null,
            isApproximate: true,
        };
    }

    /**
     * Run Robin Hood redistribution on a set of submissions.
     * Uses raw view counts.
     */
    static computeRobinHoodShares(
        submissions: Array<{ id: string; lastViewCount: number }>,
        totalCampaignViews: number,
        netBudgetTL: number
    ): Array<{ id: string; sharePercent: number; earningsTL: number }> {
        if (submissions.length === 0 || totalCampaignViews === 0) return [];

        let working = submissions.map(sub => ({
            id: sub.id,
            views: sub.lastViewCount || 0,
            sharePercent: (sub.lastViewCount || 0) / totalCampaignViews,
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
     * Update campaign aggregate totals (views-based)
     */
    static async updateCampaignTotalPoints(
        campaignId: string,
        prisma: PrismaClient,
        tx?: any
    ) {
        const db = tx || prisma;

        const agg = await db.submission.aggregate({
            where: { campaignId, status: 'APPROVED' },
            _sum: { lastViewCount: true },
            _count: true,
        });

        const totalViews = agg._sum.lastViewCount || 0;
        const totalSubmissions = agg._count;
        const averageViews = totalSubmissions > 0 ? totalViews / totalSubmissions : 0;

        await db.campaignPoolStats.upsert({
            where: { campaignId },
            create: { campaignId, totalCampaignPoints: totalViews, totalSubmissions, averagePoints: averageViews },
            update: { totalCampaignPoints: totalViews, totalSubmissions, averagePoints: averageViews },
        });

        await db.campaign.update({
            where: { id: campaignId },
            data: { totalCampaignPoints: totalViews },
        });

        return { totalCampaignViews: totalViews, totalSubmissions, averageViews, totalViews };
    }

    /**
     * Recalculate all submissions for a campaign with Robin Hood redistribution.
     * Uses raw view counts. Optionally accepts pre-filtered eligible submission IDs.
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

        const { netBudgetTL } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.commissionPercent
        );

        // If eligibleSubmissionIds provided, only those participate in Robin Hood
        const participatingSubmissions = eligibleSubmissionIds
            ? allSubmissions.filter((s: any) => eligibleSubmissionIds.includes(s.id))
            : allSubmissions;

        // Calculate total views for PARTICIPATING submissions only
        const participatingTotalViews = participatingSubmissions.reduce(
            (sum: number, s: any) => sum + (s.lastViewCount || 0), 0
        );

        if (participatingTotalViews === 0) return { recalculated: 0 };

        // Run Robin Hood on participating submissions
        const shares = this.computeRobinHoodShares(
            participatingSubmissions.map((s: any) => ({ id: s.id, lastViewCount: s.lastViewCount || 0 })),
            participatingTotalViews,
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
            data: { lastBatchAt: new Date(), lastBatchTotalPoints: participatingTotalViews },
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

            // Idempotency guard — prevent double distribution
            if (campaign.payoutStatus !== 'PENDING') {
                return { campaignId, type: 'ALREADY_PROCESSED' as const };
            }

            // 1. Final view aggregation
            const stats = await this.updateCampaignTotalPoints(campaignId, prisma, tx);

            // 2. Insurance check (budget-based thresholds: submissions + views)
            const insuranceResult = this.checkInsuranceThresholds(
                Number(campaign.totalBudget),
                stats.totalSubmissions,
                stats.totalViews
            );

            if (!insuranceResult.passed) {
                return await this._processInsuranceRefund(
                    tx, campaign, campaignId,
                    insuranceResult.failedChecks,
                    { totalSubmissions: stats.totalSubmissions, totalViews: stats.totalViews }
                );
            }

            // 3. Eligibility filter (0.01% of total views)
            const eligible = this.filterEligibleSubmissions(
                campaign.submissions.map((s: any) => ({ id: s.id, lastViewCount: s.lastViewCount || 0 })),
                stats.totalViews
            );

            if (eligible.length === 0) {
                return await this._processInsuranceRefund(
                    tx, campaign, campaignId,
                    ['No eligible submissions after threshold filter'],
                    { totalSubmissions: stats.totalSubmissions, totalViews: stats.totalViews }
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
        metrics: { totalSubmissions: number; totalViews: number }
    ): Promise<DistributionResult> {
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
