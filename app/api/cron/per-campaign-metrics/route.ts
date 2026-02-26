import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tiktokService } from "@/lib/tiktok/tiktok-service";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── Constants ──────────────────────────────────────────────────────────────
const BATCH_SIZE = 50;                          // Parallel Apify calls per batch
const MAX_SUBMISSIONS_PER_TICK = 500;           // Max submissions processed per campaign per tick
const MAX_CAMPAIGNS_PER_TICK = 3;               // Campaigns processed per cron run
const STALE_LOCK_MS = 10 * 60 * 1000;           // 10 min — auto-clear crashed processing locks
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const LOCK_WINDOW_MS = 0;                       // Lock at endDate (campaigns run full duration)
const STALE_THRESHOLD_MS = 23 * 60 * 60 * 1000; // Submission stale if checked >23h ago

/**
 * Per-Campaign Metrics Cron
 * POST/GET /api/cron/per-campaign-metrics
 *
 * Runs every 15 minutes via external cron trigger.
 * Finds up to 3 campaigns where nextMetricsFetchAt <= now,
 * processes up to 500 submissions per campaign (chunked across ticks),
 * and advances nextMetricsFetchAt by 24h once ALL submissions are refreshed.
 *
 * Concurrency: metricsProcessingAt lock prevents duplicate processing.
 * Large campaigns (>500 subs) are spread across multiple cron ticks.
 */

// ─── Auth ───────────────────────────────────────────────────────────────────

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

// ─── Types ──────────────────────────────────────────────────────────────────

interface CampaignResult {
  campaignId: string;
  refreshed: number;
  failed: number;
  remaining: number;
  cycleComplete: boolean;
  nextFetch: string | null;
  errors: string[];
}

// ─── Core Processing ────────────────────────────────────────────────────────

async function processOneCampaign(campaign: {
  id: string;
  nextMetricsFetchAt: Date | null;
  endDate: Date | null;
}): Promise<CampaignResult | null> {
  const now = new Date();

  // 1. Acquire processing lock (atomic — prevents concurrent processing)
  const staleLockCutoff = new Date(now.getTime() - STALE_LOCK_MS);
  const locked = await prisma.campaign.updateMany({
    where: {
      id: campaign.id,
      OR: [
        { metricsProcessingAt: null },
        { metricsProcessingAt: { lt: staleLockCutoff } },
      ],
    },
    data: { metricsProcessingAt: now },
  });

  if (locked.count === 0) {
    console.log(`[PerCampaignMetrics] Campaign ${campaign.id} already being processed, skipping`);
    return null;
  }

  try {
    // 2. Find stale submissions (not yet refreshed in this 24h cycle)
    const staleThreshold = campaign.nextMetricsFetchAt
      ? new Date(campaign.nextMetricsFetchAt.getTime() - STALE_THRESHOLD_MS)
      : new Date(0); // If no nextMetricsFetchAt, treat all as stale

    const staleSubmissions = await prisma.submission.findMany({
      where: {
        campaignId: campaign.id,
        status: "APPROVED",
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: staleThreshold } },
        ],
      },
      orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
      take: MAX_SUBMISSIONS_PER_TICK,
      select: { id: true, tiktokUrl: true },
    });

    // 3. If no stale submissions → cycle complete, advance nextMetricsFetchAt
    if (staleSubmissions.length === 0) {
      const nextFetch = campaign.nextMetricsFetchAt
        ? new Date(campaign.nextMetricsFetchAt.getTime() + TWENTY_FOUR_HOURS_MS)
        : new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);

      const lockDeadline = campaign.endDate
        ? new Date(campaign.endDate.getTime() - LOCK_WINDOW_MS)
        : null;

      // Stop scheduling 1.5h before endDate (90min buffer to avoid race with lock window)
      const bufferMs = 30 * 60 * 1000; // Extra 30min buffer beyond lock window
      const stopDeadline = lockDeadline ? new Date(lockDeadline.getTime() - bufferMs) : null;
      const shouldStopScheduling = stopDeadline && nextFetch >= stopDeadline;

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          nextMetricsFetchAt: shouldStopScheduling ? null : nextFetch,
          metricsProcessingAt: null,
        },
      });

      const note = shouldStopScheduling
        ? "Cycle complete — stopped scheduling (approaching lock window)"
        : "Cycle complete — advanced to next 24h window";

      console.log(`[PerCampaignMetrics] Campaign ${campaign.id}: ${note}`);

      return {
        campaignId: campaign.id,
        refreshed: 0,
        failed: 0,
        remaining: 0,
        cycleComplete: true,
        nextFetch: shouldStopScheduling ? null : nextFetch.toISOString(),
        errors: [],
      };
    }

    // 4. Process stale submissions in parallel batches
    console.log(
      `[PerCampaignMetrics] Campaign ${campaign.id}: processing ${staleSubmissions.length} stale submissions`
    );

    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < staleSubmissions.length; i += BATCH_SIZE) {
      const batch = staleSubmissions.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (sub) => {
          const { data: video } = await tiktokService.fetchVideoData(
            sub.tiktokUrl,
            'cron:per-campaign-metrics',
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
          refreshed++;
        } else {
          failed++;
          errors.push(result.reason?.message || "Unknown error");
        }
      }
    }

    // 5. Check how many submissions remain for this cycle
    const remainingCount = await prisma.submission.count({
      where: {
        campaignId: campaign.id,
        status: "APPROVED",
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: staleThreshold } },
        ],
      },
    });

    // 6. Log result
    await prisma.metricFetchLog.create({
      data: {
        campaignId: campaign.id,
        source: "PER_CAMPAIGN_CRON",
        status: failed > 0 ? (refreshed > 0 ? "PARTIAL" : "FAILED") : "SUCCESS",
        errorMessage: `Refreshed ${refreshed}/${staleSubmissions.length} submissions` +
          (failed > 0 ? `, ${failed} failed` : "") +
          (remainingCount > 0 ? `, ${remainingCount} remaining for next tick` : ""),
      },
    });

    // 7. Release processing lock (DON'T advance nextMetricsFetchAt if submissions remain)
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { metricsProcessingAt: null },
    });

    console.log(
      `[PerCampaignMetrics] Campaign ${campaign.id}: ${refreshed} refreshed, ${failed} failed, ${remainingCount} remaining`
    );

    return {
      campaignId: campaign.id,
      refreshed,
      failed,
      remaining: remainingCount,
      cycleComplete: remainingCount === 0,
      nextFetch: null, // Will be set on next tick when cycle completes
      errors: errors.slice(0, 5),
    };
  } catch (error: any) {
    // Release lock on fatal error
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { metricsProcessingAt: null },
    }).catch(() => {}); // Don't throw if cleanup fails

    console.error(`[PerCampaignMetrics] Fatal error for campaign ${campaign.id}:`, error);
    throw error;
  }
}

async function processCampaignMetrics(): Promise<{
  results: (CampaignResult | null)[];
}> {
  const now = new Date();
  const staleLockCutoff = new Date(now.getTime() - STALE_LOCK_MS);

  // Find up to 3 campaigns due for metrics refresh
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      lockedAt: null,
      nextMetricsFetchAt: { lte: now },
      OR: [
        { metricsProcessingAt: null },
        { metricsProcessingAt: { lt: staleLockCutoff } },
      ],
    },
    orderBy: { nextMetricsFetchAt: "asc" },
    take: MAX_CAMPAIGNS_PER_TICK,
    select: {
      id: true,
      nextMetricsFetchAt: true,
      endDate: true,
    },
  });

  if (campaigns.length === 0) {
    return { results: [] };
  }

  console.log(
    `[PerCampaignMetrics] Found ${campaigns.length} campaign(s) due for refresh`
  );

  // Process campaigns sequentially to avoid overloading Apify
  const results: (CampaignResult | null)[] = [];
  for (const campaign of campaigns) {
    try {
      const result = await processOneCampaign(campaign);
      results.push(result);
    } catch (error: any) {
      console.error(`[PerCampaignMetrics] Error processing campaign ${campaign.id}:`, error.message);
      results.push({
        campaignId: campaign.id,
        refreshed: 0,
        failed: 0,
        remaining: -1,
        cycleComplete: false,
        nextFetch: null,
        errors: [error.message],
      });
    }
  }

  return { results };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

async function handlePerCampaignMetrics(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[PerCampaignMetrics] Starting per-campaign metrics refresh...");

  try {
    const { results } = await processCampaignMetrics();

    const processed = results.filter(Boolean).length;
    console.log(
      `[PerCampaignMetrics] Complete: ${processed} campaign(s) processed`
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      campaignsProcessed: processed,
      results: results.length === 0
        ? { skipped: true, reason: "No campaigns due for refresh" }
        : results,
    });
  } catch (error: any) {
    console.error("[PerCampaignMetrics] Fatal error:", error);
    return NextResponse.json(
      { error: error.message || "Per-campaign metrics refresh failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handlePerCampaignMetrics(req);
}

export async function GET(req: NextRequest) {
  return handlePerCampaignMetrics(req);
}
