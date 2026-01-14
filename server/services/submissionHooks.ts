import { PrismaClient } from '@prisma/client';
import { CalculationService } from './calculationService';

/**
 * Submission Hooks
 * 
 * Automatic triggers for recalculating submission and campaign statistics
 * when submission data changes.
 */

/**
 * Hook to recalculate when submission stats are updated
 * Call this after updating lastViewCount, lastLikeCount, or lastShareCount
 */
export async function onSubmissionStatsUpdate(
    submissionId: string,
    prisma: PrismaClient
) {
    // 1. Recalculate this submission's points and earnings
    await CalculationService.updateSubmissionCalculations(submissionId, prisma);

    // 2. Get the campaign ID
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { campaignId: true }
    });

    if (submission) {
        // 3. Update campaign's total points
        await updateCampaignTotalPoints(submission.campaignId, prisma);
    }
}

/**
 * Update campaign's total points and recalculate all submissions
 * This ensures all submissions have the correct share percentage
 */
async function updateCampaignTotalPoints(
    campaignId: string,
    prisma: PrismaClient
) {
    // 1. Aggregate total points from all approved submissions
    const stats = await CalculationService.updateCampaignTotalPoints(campaignId, prisma);

    // 2. Recalculate all submissions with the new total
    // This is important because share percentage depends on total campaign points
    await CalculationService.recalculateCampaignSubmissions(campaignId, prisma);

    return stats;
}

/**
 * Hook to call when a submission is approved
 * This triggers recalculation for the entire campaign
 */
export async function onSubmissionApproved(
    submissionId: string,
    prisma: PrismaClient
) {
    // First calculate this submission
    await CalculationService.updateSubmissionCalculations(submissionId, prisma);

    // Then update campaign totals and recalculate all submissions
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { campaignId: true }
    });

    if (submission) {
        await updateCampaignTotalPoints(submission.campaignId, prisma);
    }
}

/**
 * Hook to call when a submission is rejected
 * This triggers recalculation for the entire campaign
 */
export async function onSubmissionRejected(
    submissionId: string,
    prisma: PrismaClient
) {
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { campaignId: true }
    });

    if (submission) {
        // Recalculate campaign totals (excluding this rejected submission)
        await updateCampaignTotalPoints(submission.campaignId, prisma);
    }
}

/**
 * Hook to call when a campaign is created
 * Initializes the campaign's calculated fields
 */
export async function onCampaignCreated(
    campaignId: string,
    prisma: PrismaClient
) {
    await CalculationService.initializeCampaign(campaignId, prisma);
}
