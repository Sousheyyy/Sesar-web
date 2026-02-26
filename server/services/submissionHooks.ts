import { PrismaClient } from '@prisma/client';
import { CalculationService } from './calculationService';

/**
 * Submission Hooks (v2)
 *
 * Key change: No longer triggers full Robin Hood recalculation on every submission.
 * Only updates individual submission points and campaign aggregate totals.
 * Full recalculation happens during batch windows (webhook-driven) and final distribution.
 */

/**
 * Hook: submission stats updated (views/likes/shares changed).
 * Updates points for this submission and campaign aggregate totals.
 * Does NOT trigger full Robin Hood recalculation.
 */
export async function onSubmissionStatsUpdate(
    submissionId: string,
    prisma: PrismaClient
) {
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { campaignId: true },
    });

    if (submission) {
        await CalculationService.updateCampaignTotalPoints(submission.campaignId, prisma);
    }
}

/**
 * Hook: submission approved.
 * Same as stats update — calculate points and update totals.
 */
export async function onSubmissionApproved(
    submissionId: string,
    prisma: PrismaClient
) {
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { campaignId: true },
    });

    if (submission) {
        await CalculationService.updateCampaignTotalPoints(submission.campaignId, prisma);
    }
}

/**
 * Hook: submission rejected.
 * Recalculate campaign totals (this submission now excluded).
 */
export async function onSubmissionRejected(
    submissionId: string,
    prisma: PrismaClient
) {
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { campaignId: true },
    });

    if (submission) {
        await CalculationService.updateCampaignTotalPoints(submission.campaignId, prisma);
    }
}

/**
 * Hook: campaign created.
 * Initialize calculated fields and pool stats.
 */
export async function onCampaignCreated(
    campaignId: string,
    prisma: PrismaClient
) {
    await CalculationService.initializeCampaign(campaignId, prisma);
}
