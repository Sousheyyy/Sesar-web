import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apifyClient } from "@/lib/apify/client";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 10;
const REFRESH_TTL_MS = 20 * 60 * 60 * 1000; // 20 hours — prevents double-run on same day

/**
 * Daily Metrics Refresh Cron
 * POST/GET /api/cron/daily-metrics
 *
 * Runs daily at 21:00 UTC (midnight Istanbul) via external cron trigger.
 * Fetches updated video stats from Apify for all APPROVED submissions
 * in ACTIVE campaigns that haven't been refreshed in the last 20 hours.
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

async function refreshMetrics() {
  const ttlCutoff = new Date(Date.now() - REFRESH_TTL_MS);

  // Find all approved submissions in active campaigns that need refresh
  const submissions = await prisma.submission.findMany({
    where: {
      status: "APPROVED",
      campaign: { status: "ACTIVE", lockedAt: null },
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: ttlCutoff } },
      ],
    },
    select: {
      id: true,
      tiktokUrl: true,
      campaignId: true,
    },
    orderBy: { lastCheckedAt: "asc" }, // oldest first
  });

  if (submissions.length === 0) {
    return { refreshed: 0, failed: 0, skipped: 0, total: 0 };
  }

  let refreshed = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process in batches
  for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
    const batch = submissions.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (sub) => {
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

    // Log batch progress
    await prisma.metricFetchLog.create({
      data: {
        campaignId: batch[0].campaignId,
        source: "DAILY_CRON",
        status: failed > 0 ? "PARTIAL" : "SUCCESS",
        errorMessage: `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${results.filter((r) => r.status === "fulfilled").length}/${batch.length} refreshed`,
      },
    });
  }

  return {
    total: submissions.length,
    refreshed,
    failed,
    errors: errors.slice(0, 10), // cap error list
  };
}

async function handleDailyMetrics(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[DailyMetrics] Starting daily metric refresh...");

  try {
    const result = await refreshMetrics();

    console.log(
      `[DailyMetrics] Complete: ${result.refreshed}/${result.total} refreshed, ${result.failed} failed`
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("[DailyMetrics] Fatal error:", error);
    return NextResponse.json(
      { error: error.message || "Daily metrics refresh failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleDailyMetrics(req);
}

export async function GET(req: NextRequest) {
  return handleDailyMetrics(req);
}
