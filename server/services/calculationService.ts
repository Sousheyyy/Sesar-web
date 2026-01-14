import { PrismaClient } from '@prisma/client';

/**
 * Calculation Service
 * 
 * Centralized service for all campaign and submission calculations.
 * This is the SINGLE SOURCE OF TRUTH for all calculation logic.
 */
export class CalculationService {
    private static readonly VIEW_POINT_MULTIPLIER = 0.01;
    private static readonly LIKE_POINT_MULTIPLIER = 0.5;
    private static readonly SHARE_POINT_MULTIPLIER = 1.0;
    private static readonly MAX_SHARE_PERCENT = 0.40; // Robin Hood cap
    private static readonly MAX_CAPPED_USERS = 2; // Only 2 users can reach 40%

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

        // Apply Robin Hood cap - no one can earn more than 40%
        if (sharePercent > this.MAX_SHARE_PERCENT) {
            sharePercent = this.MAX_SHARE_PERCENT;
        }

        return sharePercent;
    }

    /**
     * Calculate net budget after fees
     */
    static calculateNetBudget(
        totalBudget: number,
        platformFeePercent: number,
        safetyReservePercent: number
    ) {
        const netMultiplier = (100 - platformFeePercent - safetyReservePercent) / 100;
        const netBudgetTP = totalBudget * 10 * netMultiplier;

        return { netBudgetTP, netMultiplier };
    }

    /**
     * Calculate estimated earnings for a submission
     */
    static calculateEstimatedEarnings(
        myPoints: number,
        totalCampaignPoints: number,
        netBudgetTP: number
    ): number {
        const sharePercent = this.calculateSharePercent(myPoints, totalCampaignPoints);
        return netBudgetTP * sharePercent;
    }

    /**
     * Update submission with calculated values
     */
    static async updateSubmissionCalculations(
        submissionId: string,
        prisma: PrismaClient,
        tx?: any // Optional transaction context
    ) {
        const db = tx || prisma; // Use transaction if provided

        const submission = await db.submission.findUnique({
            where: { id: submissionId },
            include: {
                campaign: {
                    include: {
                        poolStats: true
                    }
                }
            }
        });

        if (!submission) throw new Error('Submission not found');

        // Calculate points
        const points = this.calculatePoints(
            submission.lastViewCount || 0,
            submission.lastLikeCount || 0,
            submission.lastShareCount || 0
        );

        // Calculate net budget
        const { netBudgetTP } = this.calculateNetBudget(
            Number(submission.campaign.totalBudget),
            submission.campaign.platformFeePercent,
            submission.campaign.safetyReservePercent
        );

        // Only update points here - share percentages will be calculated
        // by recalculateCampaignSubmissions() with proper redistribution
        await db.submission.update({
            where: { id: submissionId },
            data: {
                viewPoints: points.viewPoints,
                likePoints: points.likePoints,
                sharePoints: points.sharePoints,
                totalPoints: points.totalPoints,
                // Don't set sharePercent or estimatedEarnings here
                // They will be calculated with proper redistribution
            }
        });

        return { points, sharePercent: 0, estimatedEarnings: 0 };
    }

    /**
     * Update campaign's total points and recalculate all submissions
     */
    static async updateCampaignTotalPoints(
        campaignId: string,
        prisma: PrismaClient,
        tx?: any // Optional transaction context
    ) {
        const db = tx || prisma;

        // Aggregate total points from all approved submissions
        const totalPoints = await db.submission.aggregate({
            where: { campaignId, status: 'APPROVED' },
            _sum: { totalPoints: true },
            _count: true
        });

        const totalCampaignPoints = totalPoints._sum.totalPoints || 0;
        const totalSubmissions = totalPoints._count;
        const averagePoints = totalSubmissions > 0 ? totalCampaignPoints / totalSubmissions : 0;

        // Update or create pool stats
        await db.campaignPoolStats.upsert({
            where: { campaignId },
            create: {
                campaignId,
                totalCampaignPoints,
                totalSubmissions,
                averagePoints
            },
            update: {
                totalCampaignPoints,
                totalSubmissions,
                averagePoints
            }
        });

        // Also update campaign's direct fields
        await db.campaign.update({
            where: { id: campaignId },
            data: { totalCampaignPoints }
        });

        return { totalCampaignPoints, totalSubmissions, averagePoints };
    }

    /**
     * Recalculate all submissions for a campaign with proper Robin Hood redistribution
     */
    static async recalculateCampaignSubmissions(
        campaignId: string,
        prisma: PrismaClient,
        tx?: any // Optional transaction context
    ) {
        const db = tx || prisma;

        const campaign = await db.campaign.findUnique({
            where: { id: campaignId },
            include: {
                poolStats: true,
                submissions: {
                    where: { status: 'APPROVED' }
                }
            }
        });

        if (!campaign) return { recalculated: 0 };

        const submissions = campaign.submissions;
        if (submissions.length === 0) return { recalculated: 0 };

        const totalCampaignPoints = campaign.poolStats?.totalCampaignPoints || 0;
        if (totalCampaignPoints === 0) return { recalculated: 0 };

        // Calculate net budget
        const { netBudgetTP } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.platformFeePercent,
            campaign.safetyReservePercent
        );

        // Step 1: Calculate raw percentages for all submissions
        const submissionData = submissions.map(sub => ({
            id: sub.id,
            points: sub.totalPoints || 0,
            rawPercent: (sub.totalPoints || 0) / totalCampaignPoints
        }));

        // Step 2: Apply Robin Hood cap and redistribute iteratively
        const finalShares: { id: string; sharePercent: number; estimatedEarnings: number }[] = [];

        // Iterative redistribution to ensure exactly 100%
        let working = submissionData.map(sub => ({
            id: sub.id,
            points: sub.points,
            sharePercent: sub.rawPercent,
            isCapped: false
        }));

        let iterations = 0;
        const MAX_ITERATIONS = 10; // Prevent infinite loops

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            // Count how many users are already capped at 40%
            const cappedCount = working.filter(sub => sub.isCapped).length;

            // Cap anyone over 40%, but respect max capped users limit
            let hasNewCaps = false;
            for (const sub of working) {
                if (!sub.isCapped && sub.sharePercent > this.MAX_SHARE_PERCENT) {
                    // Only allow cap if we haven't hit the limit of 2 max earners
                    if (cappedCount < this.MAX_CAPPED_USERS) {
                        sub.sharePercent = this.MAX_SHARE_PERCENT;
                        sub.isCapped = true;
                        hasNewCaps = true;
                    } else {
                        // Already have 2 capped users, cap this one just below 40%
                        sub.sharePercent = this.MAX_SHARE_PERCENT - 0.0001; // 39.99%
                        sub.isCapped = true; // Mark as capped to prevent redistribution
                        hasNewCaps = true;
                    }
                }
            }

            // Calculate current total
            const currentTotal = working.reduce((sum, sub) => sum + sub.sharePercent, 0);

            // If we're at 100% (within floating point tolerance), we're done
            if (Math.abs(currentTotal - 1.0) < 0.0001) {
                break;
            }

            // If total < 100% and there are uncapped submissions, redistribute
            if (currentTotal < 1.0) {
                const excess = 1.0 - currentTotal;
                const uncapped = working.filter(sub => !sub.isCapped);

                if (uncapped.length === 0) {
                    // All capped but total < 100% - distribute equally among all (edge case)
                    const perSubmission = excess / working.length;
                    for (const sub of working) {
                        sub.sharePercent += perSubmission;
                    }
                    break;
                } else {
                    // Redistribute proportionally among uncapped
                    const uncappedTotal = uncapped.reduce((sum, sub) => sum + sub.sharePercent, 0);

                    for (const sub of working) {
                        if (!sub.isCapped && uncappedTotal > 0) {
                            const additionalShare = (sub.sharePercent / uncappedTotal) * excess;
                            sub.sharePercent += additionalShare;
                        }
                    }
                }
            } else {
                // Total > 100% - shouldn't happen but handle it
                break;
            }

            // If no new caps were added in this iteration and we just redistributed, we're done
            if (!hasNewCaps) {
                break;
            }
        }

        // Build final shares
        for (const sub of working) {
            finalShares.push({
                id: sub.id,
                sharePercent: sub.sharePercent,
                estimatedEarnings: netBudgetTP * sub.sharePercent
            });
        }

        // Step 3: Update all submissions with final shares AND totalEarnings
        for (const share of finalShares) {
            const earningsTL = share.estimatedEarnings / 10; // Convert to TL
            await db.submission.update({
                where: { id: share.id },
                data: {
                    sharePercent: share.sharePercent,
                    estimatedEarnings: earningsTL,
                    totalEarnings: earningsTL // Set totalEarnings here
                }
            });
        }

        return { recalculated: finalShares.length };
    }

    /**
     * Initialize campaign calculations (call when campaign is created)
     */
    static async initializeCampaign(
        campaignId: string,
        prisma: PrismaClient
    ) {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId }
        });

        if (!campaign) throw new Error('Campaign not found');

        // Calculate net budget
        const { netBudgetTP, netMultiplier } = this.calculateNetBudget(
            Number(campaign.totalBudget),
            campaign.platformFeePercent,
            campaign.safetyReservePercent
        );

        // Update campaign with calculated values
        await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                netBudgetTP,
                netMultiplier,
                totalCampaignPoints: 0
            }
        });

        // Create pool stats
        await prisma.campaignPoolStats.create({
            data: {
                campaignId,
                totalCampaignPoints: 0,
                totalSubmissions: 0,
                averagePoints: 0
            }
        });

        return { netBudgetTP, netMultiplier };
    }
}
