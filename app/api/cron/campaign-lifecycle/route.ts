import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCampaignPayouts } from "@/lib/payout";
import { tiktokService } from "@/lib/tiktok/tiktok-service";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const LOCK_WINDOW_MS = 0; // Lock at endDate (campaigns run their full duration)
const GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour after endDate before distributing (allows final fetch to complete)
const BATCH_SIZE = 50; // Parallel API calls per batch

/**
 * Campaign Lifecycle Cron
 * POST/GET /api/cron/campaign-lifecycle
 *
 * Runs every 5 minutes via Cloudflare Cron Trigger.
 * Processes ONE campaign per phase per run for safety.
 *
 * Phase A: Lock campaigns that have reached endDate
 *   → Prevents new submissions
 *   → Fetches final metrics for ALL submissions (batched, 50 parallel)
 *
 * Phase B: Distribute locked campaigns past endDate + 1h grace
 *   → Insurance check → Eligibility → Robin Hood → Wallet payouts
 */

async function authenticate(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  try {
    const session = await auth();
    if (session?.user?.role === UserRole.ADMIN) return true;
  } catch {}

  return false;
}

// ─── Phase A: Lock ──────────────────────────────────────────────────────────

interface LockResult {
  campaignId: string;
  submissionCount: number;
  accountsRefreshed: number;
  refreshErrors: string[];
  retried?: boolean;
}

async function lockOneCampaign(): Promise<LockResult | null> {
  const now = new Date();
  const lockDeadline = new Date(now.getTime() + LOCK_WINDOW_MS);

  // Find ONE unlocked campaign whose endDate has passed
  const campaign = await prisma.campaign.findFirst({
    where: {
      status: "ACTIVE",
      lockedAt: null,
      endDate: { lte: lockDeadline },
    },
    orderBy: { endDate: "asc" },
    include: {
      submissions: {
        where: { status: "APPROVED" },
        select: { id: true, creatorId: true },
      },
    },
  });

  if (!campaign) return null;

  // Skip campaigns with 0 approved submissions — nothing to lock/refresh
  if (campaign.submissions.length === 0) {
    console.log(`[Lifecycle] Campaign ${campaign.id} has 0 approved submissions, skipping lock`);
    return null;
  }

  // Atomically lock
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { lockedAt: new Date() },
  });

  console.log(
    `[Lifecycle] Locked campaign ${campaign.id} (${campaign.submissions.length} submissions)`
  );

  // Fetch ALL approved submissions with their TikTok URLs for final metrics refresh
  const submissions = await prisma.submission.findMany({
    where: { campaignId: campaign.id, status: "APPROVED" },
    select: { id: true, tiktokUrl: true },
  });

  // Refresh metrics in parallel batches of 50
  const refreshErrors: string[] = [];
  let refreshedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
    const batch = submissions.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (sub) => {
        const { data: video } = await tiktokService.fetchVideoData(
          sub.tiktokUrl,
          'cron:campaign-lifecycle',
          campaign.id
        );
        await prisma.submission.update({
          where: { id: sub.id },
          data: {
            lastViewCount: video.stats.playCount,
            lastLikeCount: video.stats.diggCount,
            lastCommentCount: video.stats.commentCount,
            lastShareCount: video.stats.shareCount,
            lastCheckedAt: new Date(),
          },
        });
        return sub.id;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        refreshedCount++;
      } else {
        failedCount++;
        const msg = result.reason?.message || "Unknown error";
        refreshErrors.push(msg);
        console.error(`[Lifecycle] Refresh error: ${msg}`);
      }
    }
  }

  // Check failure rate — if >20%, unlock and retry on next tick (max 3 retries)
  const totalCount = submissions.length;
  const failureRate = totalCount > 0 ? failedCount / totalCount : 0;

  if (failureRate > 0.20 && totalCount > 0) {
    // Count previous retry attempts for this campaign
    const retryCount = await prisma.metricFetchLog.count({
      where: { campaignId: campaign.id, source: "LOCK_PHASE", status: "RETRY" },
    });

    if (retryCount < 3) {
      // Unlock — campaign will be re-locked on next tick
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { lockedAt: null },
      });

      await prisma.metricFetchLog.create({
        data: {
          campaignId: campaign.id,
          source: "LOCK_PHASE",
          status: "RETRY",
          errorMessage: `High failure rate (${Math.round(failureRate * 100)}%), retry ${retryCount + 1}/3. ${refreshedCount}/${totalCount} refreshed.`,
        },
      });

      console.log(
        `[Lifecycle] High failure rate for ${campaign.id} (${Math.round(failureRate * 100)}%), unlocking for retry ${retryCount + 1}/3`
      );

      return {
        campaignId: campaign.id,
        submissionCount: totalCount,
        accountsRefreshed: refreshedCount,
        refreshErrors,
        retried: true,
      };
    }
    // Max retries reached — proceed with partial data
    console.warn(
      `[Lifecycle] Max retries reached for ${campaign.id}, proceeding with ${refreshedCount}/${totalCount} submissions`
    );
  }

  // Single summary log entry for the lock phase
  await prisma.metricFetchLog.create({
    data: {
      campaignId: campaign.id,
      source: "LOCK_PHASE",
      status: failedCount > 0 ? (refreshedCount > 0 ? "PARTIAL" : "FAILED") : "SUCCESS",
      errorMessage: `Final refresh: ${refreshedCount}/${totalCount} submissions` +
        (failedCount > 0 ? `, ${failedCount} failed` : ""),
    },
  });

  console.log(
    `[Lifecycle] Lock phase complete for ${campaign.id}: ${refreshedCount} refreshed, ${failedCount} failed`
  );

  return {
    campaignId: campaign.id,
    submissionCount: totalCount,
    accountsRefreshed: refreshedCount,
    refreshErrors,
  };
}

// ─── Phase B: Distribute ────────────────────────────────────────────────────

interface DistributeResult {
  campaignId: string;
  type: string;
  success: boolean;
  error?: string;
}

async function distributeOneCampaign(): Promise<DistributeResult | null> {
  const now = new Date();
  const graceDeadline = new Date(now.getTime() - GRACE_PERIOD_MS);

  // Find ONE locked campaign past the grace period that hasn't been distributed
  const campaign = await prisma.campaign.findFirst({
    where: {
      status: "ACTIVE",
      payoutStatus: "PENDING",
      lockedAt: { not: null },
      endDate: { lte: graceDeadline },
    },
    orderBy: { endDate: "asc" },
  });

  if (!campaign) return null;

  console.log(`[Lifecycle] Distributing campaign ${campaign.id}...`);

  try {
    const result = await calculateCampaignPayouts(campaign.id);

    console.log(
      `[Lifecycle] Distribution complete for ${campaign.id}: ${result.type}`
    );

    return {
      campaignId: campaign.id,
      type: result.type,
      success: true,
    };
  } catch (error: any) {
    console.error(
      `[Lifecycle] Distribution failed for ${campaign.id}:`,
      error
    );

    return {
      campaignId: campaign.id,
      type: "ERROR",
      success: false,
      error: error.message,
    };
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

async function handleLifecycle(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockResult = await lockOneCampaign();
  const distributeResult = await distributeOneCampaign();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    lock: lockResult || { skipped: true, reason: "No campaigns to lock" },
    distribute: distributeResult || {
      skipped: true,
      reason: "No campaigns to distribute",
    },
  });
}

export async function POST(req: NextRequest) {
  return handleLifecycle(req);
}

export async function GET(req: NextRequest) {
  return handleLifecycle(req);
}
