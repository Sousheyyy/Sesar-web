import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { tiktokScraper } from "@/lib/tiktok-scraper";

/**
 * Calculate the Impact Score for a submission based on the weighted engagement model
 * Formula: Score = (Views × 0.01) + (Likes × 0.5) + (Shares × 1)
 */
export function calculateImpactScore(
  views: number,
  likes: number,
  shares: number
): number {
  return views * 0.01 + likes * 0.5 + shares * 1.0;
}

interface SubmissionWithScore {
  id: string;
  creatorId: string;
  lastViewCount: number;
  lastLikeCount: number;
  lastShareCount: number;
  impactScore: number;
  rawPayout: number;
  finalPayout: number;
  contributionPercent: number;
}

/**
 * Core logic to distribute pool amount among submissions
 */
function calculatePoolDistribution(
  submissions: any[],
  poolAmount: number
): SubmissionWithScore[] {
  const CAP_PERCENTAGE = 0.4; // 40% maximum per submission
  const MAX_CAPPED_USERS = 2; // Only 2 users can reach 40%

  // 1. Calculate Impact Scores
  let totalScore = 0;
  const scoredSubmissions: SubmissionWithScore[] = submissions.map((sub) => {
    const score = calculateImpactScore(
      sub.lastViewCount,
      sub.lastLikeCount,
      sub.lastShareCount
    );
    totalScore += score;
    return {
      id: sub.id,
      creatorId: sub.creatorId,
      lastViewCount: sub.lastViewCount,
      lastLikeCount: sub.lastLikeCount,
      lastShareCount: sub.lastShareCount,
      impactScore: score,
      rawPayout: 0,
      finalPayout: 0,
      contributionPercent: 0,
    };
  });

  if (totalScore === 0) {
    // No engagement, distribute equally (fallback)
    if (submissions.length > 0) {
      const equalShare = poolAmount / submissions.length;
      scoredSubmissions.forEach((sub) => {
        sub.rawPayout = equalShare;
        sub.finalPayout = equalShare;
        sub.contributionPercent = 0;
      });
    }
  } else {
    // 2. Calculate Initial Payouts (Pro-Rata)
    scoredSubmissions.forEach((sub) => {
      sub.rawPayout = (sub.impactScore / totalScore) * poolAmount;
      sub.finalPayout = sub.rawPayout;
      sub.contributionPercent = (sub.impactScore / totalScore) * 100;
    });

    // 3. Apply "Robin Hood Cap" (40% maximum) with iterative redistribution
    const capAmount = poolAmount * CAP_PERCENTAGE;
    const cappedSubmissions = new Set<string>();
    let redistributionComplete = false;
    let iterations = 0;
    const maxIterations = scoredSubmissions.length; // Prevent infinite loops

    // Iteratively redistribute overflow until no more caps are hit
    while (!redistributionComplete && iterations < maxIterations) {
      iterations++;
      let overflowAmount = 0;
      let newlyCapped = false;

      // Count how many are already at 40% cap
      const currentCappedCount = cappedSubmissions.size;

      // Identify submissions that exceed the cap
      scoredSubmissions.forEach((sub) => {
        if (sub.finalPayout > capAmount && !cappedSubmissions.has(sub.id)) {
          // Only allow cap at 40% if we haven't hit the limit
          if (currentCappedCount < MAX_CAPPED_USERS) {
            overflowAmount += sub.finalPayout - capAmount;
            sub.finalPayout = capAmount;
            cappedSubmissions.add(sub.id);
            newlyCapped = true;
          } else {
            // Already have 2 users at 40%, cap this one just below
            const justBelowCap = capAmount * 0.9999; // 39.99%
            overflowAmount += sub.finalPayout - justBelowCap;
            sub.finalPayout = justBelowCap;
            cappedSubmissions.add(sub.id);
            newlyCapped = true;
          }
        }
      });

      // If there's overflow and we have non-capped submissions
      if (overflowAmount > 0 && cappedSubmissions.size < scoredSubmissions.length) {
        const nonCappedSubmissions = scoredSubmissions.filter(
          (sub) => !cappedSubmissions.has(sub.id)
        );

        // Calculate total score of non-capped submissions
        const nonCappedTotalScore = nonCappedSubmissions.reduce(
          (sum, sub) => sum + sub.impactScore,
          0
        );

        if (nonCappedTotalScore > 0) {
          // Redistribute overflow proportionally
          nonCappedSubmissions.forEach((sub) => {
            const redistributionShare =
              (sub.impactScore / nonCappedTotalScore) * overflowAmount;
            sub.finalPayout += redistributionShare;
          });
        } else {
          // Edge case: all remaining creators have 0 score, distribute equally
          const equalShare = overflowAmount / nonCappedSubmissions.length;
          nonCappedSubmissions.forEach((sub) => {
            sub.finalPayout += equalShare;
          });
        }
      } else {
        // No more redistribution possible
        redistributionComplete = true;
      }

      // If no new caps were hit in this iteration, we're done
      if (!newlyCapped && overflowAmount === 0) {
        redistributionComplete = true;
      }
    }
  }

  return scoredSubmissions;
}

/**
 * Update estimated payouts for all approved submissions in a campaign
 */
export async function updateEstimatedPayouts(campaignId: string) {
  // 1. Get Campaign & Submissions
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      submissions: {
        where: {
          status: "APPROVED",
        },
      },
    },
  });

  if (!campaign) return;
  if (campaign.submissions.length === 0) return;

  // 2. Calculate Creator Pool
  const totalBudget = Number(campaign.totalBudget);
  const platformFeePercent = campaign.platformFeePercent;
  const safetyReservePercent = campaign.safetyReservePercent;

  const poolPercent = 100 - platformFeePercent - safetyReservePercent;
  const poolAmount = (totalBudget * poolPercent) / 100;

  // 3. Calculate Distribution
  const distribution = calculatePoolDistribution(campaign.submissions, poolAmount);

  // 4. Update Submissions with Estimates
  await prisma.$transaction(
    distribution.map((sub) =>
      prisma.submission.update({
        where: { id: sub.id },
        data: {
          estimatedEarnings: new Decimal(sub.finalPayout),
          contributionPercent: sub.contributionPercent,
        },
      })
    )
  );

  return distribution;
}

/**
 * Calculate payouts for a campaign using the Weighted Engagement Pool model
 * Implements the "Robin Hood Cap" at 40% maximum per submission
 */
export async function calculateCampaignPayouts(campaignId: string) {
  // 1. Get Campaign & Submissions
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      submissions: {
        where: {
          status: "APPROVED", // Only approved submissions get paid
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.payoutStatus === "COMPLETED") {
    throw new Error("Payouts have already been processed for this campaign");
  }

  const submissions = campaign.submissions;

  if (submissions.length === 0) {
    // No approved submissions, mark payout as completed
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        payoutStatus: "COMPLETED",
        status: "COMPLETED",
      },
    });
    return { message: "No approved submissions to pay", payouts: [] };
  }

  // 2. Calculate Creator Pool
  const totalBudget = Number(campaign.totalBudget);
  const platformFeePercent = campaign.platformFeePercent;
  const safetyReservePercent = campaign.safetyReservePercent;

  const poolPercent = 100 - platformFeePercent - safetyReservePercent;
  const poolAmount = (totalBudget * poolPercent) / 100;

  // 3. Calculate Distribution using shared logic
  const scoredSubmissions = calculatePoolDistribution(submissions, poolAmount);

  // Calculate total score for reporting
  const totalScore = scoredSubmissions.reduce((sum, sub) => sum + sub.impactScore, 0);

  // 6. Update database with payouts in a transaction
  const payoutResults = await prisma.$transaction(async (tx) => {
    const results: Array<{
      submissionId: string;
      creatorId: string;
      impactScore: number;
      payout: number;
      transactionId: string;
    }> = [];

    for (const submission of scoredSubmissions) {
      // Update submission with impact score and payout amount
      await tx.submission.update({
        where: { id: submission.id },
        data: {
          impactScore: submission.impactScore,
          payoutAmount: new Decimal(submission.finalPayout),
          totalEarnings: {
            increment: new Decimal(submission.finalPayout),
          },
          // Also update estimates to final values
          estimatedEarnings: new Decimal(submission.finalPayout),
          contributionPercent: submission.contributionPercent,
        },
      });

      // Create transaction record for the creator
      const transaction = await tx.transaction.create({
        data: {
          userId: submission.creatorId,
          type: "EARNING",
          amount: new Decimal(submission.finalPayout),
          status: "COMPLETED",
          description: `Campaign payout: ${campaign.title}`,
          reference: submission.id,
        },
      });

      // Update creator balance
      await tx.user.update({
        where: { id: submission.creatorId },
        data: {
          balance: {
            increment: new Decimal(submission.finalPayout),
          },
        },
      });

      // Create notification for creator
      await tx.notification.create({
        data: {
          userId: submission.creatorId,
          title: "Ödeme Alındı",
          message: `"${campaign.title}" kampanyasından ${submission.finalPayout.toFixed(2)} TL kazandınız!`,
          link: `/dashboard/transactions`,
        },
      });

      results.push({
        submissionId: submission.id,
        creatorId: submission.creatorId,
        impactScore: submission.impactScore,
        payout: submission.finalPayout,
        transactionId: transaction.id,
      });
    }

    // Mark campaign payout as completed
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        payoutStatus: "COMPLETED",
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return results;
  }, {
    timeout: 30000, // 30 seconds timeout for payout processing
  });

  return {
    message: "Payouts processed successfully",
    campaignId,
    poolAmount,
    totalScore,
    payouts: payoutResults,
  };
}

/**
 * Refresh metrics for all approved submissions in a campaign
 * Should be called before final payout calculation to ensure latest metrics
 */
export async function refreshCampaignMetrics(campaignId: string) {
  const submissions = await prisma.submission.findMany({
    where: {
      campaignId,
      status: "APPROVED",
    },
  });

  const results = {
    total: submissions.length,
    updated: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const submission of submissions) {
    try {
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      // Fetch fresh video data
      const videoData = await tiktokScraper.verifyVideo(submission.tiktokUrl);

      // Update metrics
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          lastViewCount: videoData.views,
          lastLikeCount: videoData.likes,
          lastCommentCount: videoData.comments,
          lastShareCount: videoData.shares,
          lastCheckedAt: new Date(),
        },
      });

      results.updated++;
    } catch (error: any) {
      console.error(`Failed to refresh metrics for submission ${submission.id}:`, error);
      results.failed++;
      results.errors.push(`Submission ${submission.id}: ${error.message}`);

      // Don't fail the entire refresh if one video fails
      // The payout will use the last known metrics
    }
  }

  // After refreshing metrics, update estimated payouts
  if (results.updated > 0) {
    await updateEstimatedPayouts(campaignId);
  }

  return results;
}

/**
 * Find and process payouts for all campaigns that have ended
 */
export async function processEndedCampaigns() {
  const now = new Date();

  // Find campaigns that have ended and need payout processing
  const endedCampaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      payoutStatus: "PENDING",
      endDate: {
        lte: now,
      },
    },
  });

  const results: Array<{
    message: string;
    campaignId?: string;
    poolAmount?: number;
    totalScore?: number;
    payouts: any[];
    metricsRefresh: any;
  }> = [];
  const errors: Array<{
    campaignId: string;
    error: string;
  }> = [];

  for (const campaign of endedCampaigns) {
    try {
      // Refresh metrics for all submissions before calculating final payouts

      const metricsRefresh = await refreshCampaignMetrics(campaign.id);


      // Calculate and process payouts
      const result = await calculateCampaignPayouts(campaign.id);
      results.push({
        ...result,
        metricsRefresh,
      });
    } catch (error: any) {
      console.error(`Failed to process payout for campaign ${campaign.id}:`, error);
      errors.push({
        campaignId: campaign.id,
        error: error.message,
      });
    }
  }

  return {
    processed: results.length,
    failed: errors.length,
    results,
    errors,
  };
}
