import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCampaignPayouts } from "@/lib/payout";
import { apifyClient } from "@/lib/apify/client";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const LOCK_WINDOW_MS = 60 * 60 * 1000; // 1 hour before endDate
const GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 min after endDate before distributing

/**
 * Campaign Lifecycle Cron
 * POST/GET /api/cron/campaign-lifecycle
 *
 * Runs every 5 minutes via Cloudflare Cron Trigger.
 * Processes ONE campaign per phase per run for safety.
 *
 * Phase A: Lock campaigns approaching endDate (1 hour before)
 *   → Prevents new submissions
 *   → Triggers Apify on-demand refresh for final metrics
 *
 * Phase B: Distribute locked campaigns past endDate + 30 min grace
 *   → Insurance check → Eligibility → Robin Hood → Wallet payouts
 */

async function authenticate(req: NextRequest): Promise<boolean> {
  // Option 1: Cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Option 2: Admin session
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
}

async function lockOneCampaign(): Promise<LockResult | null> {
  const now = new Date();
  const lockDeadline = new Date(now.getTime() + LOCK_WINDOW_MS);

  // Find ONE unlocked campaign whose endDate is within the next hour
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

  // Atomically lock (if another run beat us, this is still safe — lockedAt is already set)
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { lockedAt: new Date() },
  });

  console.log(
    `[Lifecycle] Locked campaign ${campaign.id} (${campaign.submissions.length} submissions)`
  );

  // Refresh metrics for each approved submission via Apify
  const refreshErrors: string[] = [];
  let refreshedCount = 0;

  // Fetch submissions with their TikTok URLs
  const submissions = await prisma.submission.findMany({
    where: { campaignId: campaign.id, status: "APPROVED" },
    select: { id: true, tiktokUrl: true },
  });

  for (const sub of submissions) {
    try {
      const { video } = await apifyClient.fetchVideoData(sub.tiktokUrl);
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
      refreshedCount++;

      await prisma.metricFetchLog.create({
        data: {
          campaignId: campaign.id,
          source: "ON_DEMAND",
          status: "SUCCESS",
          errorMessage: `Refreshed submission ${sub.id} via Apify`,
        },
      });
    } catch (error: any) {
      const msg = `${sub.id}: ${error.message}`;
      refreshErrors.push(msg);

      await prisma.metricFetchLog.create({
        data: {
          campaignId: campaign.id,
          source: "ON_DEMAND",
          status: "FAILED",
          errorMessage: `Failed refresh for submission ${sub.id}: ${error.message}`,
        },
      });

      console.error(`[Lifecycle] Refresh error: ${msg}`);
    }
  }

  return {
    campaignId: campaign.id,
    submissionCount: campaign.submissions.length,
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
