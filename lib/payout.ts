import { prisma } from "@/lib/prisma";
import { CalculationService } from "@/server/services/calculationService";

/**
 * Payout Processing Library (v2)
 *
 * Delegates all calculation logic to CalculationService (single source of truth).
 * This file provides high-level orchestration for campaign end processing.
 */

/**
 * Update estimated payouts for all approved submissions in a campaign.
 * Delegates to CalculationService.recalculateCampaignSubmissions().
 */
export async function updateEstimatedPayouts(campaignId: string) {
  await CalculationService.updateCampaignTotalPoints(campaignId, prisma);
  const result = await CalculationService.recalculateCampaignSubmissions(campaignId, prisma);
  return result;
}

/**
 * Process final distribution for a single campaign.
 * Handles insurance check, eligibility filter, Robin Hood, and wallet payouts.
 */
export async function calculateCampaignPayouts(campaignId: string) {
  return await CalculationService.processFinalDistribution(campaignId, prisma);
}

/**
 * Find and process payouts for all campaigns that have ended.
 * Called by the distribute cron job (00:15 UTC+3).
 */
export async function processEndedCampaigns() {
  const now = new Date();

  const endedCampaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      payoutStatus: "PENDING",
      lockedAt: { not: null },
      endDate: { lte: now },
    },
  });

  const results: Array<any> = [];
  const errors: Array<{ campaignId: string; error: string }> = [];

  for (const campaign of endedCampaigns) {
    try {
      const result = await CalculationService.processFinalDistribution(campaign.id, prisma);
      results.push(result);
    } catch (error: any) {
      console.error(`[Payout] Failed for campaign ${campaign.id}:`, error);
      errors.push({ campaignId: campaign.id, error: error.message });
    }
  }

  return {
    processed: results.length,
    failed: errors.length,
    results,
    errors,
  };
}
