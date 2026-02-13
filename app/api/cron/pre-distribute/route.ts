import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerInsightIQRefresh } from "@/app/api/webhook/insightiq/route";

export const dynamic = "force-dynamic";

/**
 * Cron: Pre-Distribution Lock
 * Schedule: Daily at 23:00 Europe/Istanbul (UTC+3)
 *
 * 1. Finds campaigns ending today
 * 2. Locks them (no new submissions)
 * 3. Triggers InsightIQ on-demand refresh for all submissions' creator accounts
 */
export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Calculate midnight tonight in Turkey time (UTC+3)
  const turkeyOffset = 3 * 60 * 60 * 1000;
  const turkeyNow = new Date(now.getTime() + turkeyOffset);
  const todayMidnight = new Date(
    Date.UTC(turkeyNow.getUTCFullYear(), turkeyNow.getUTCMonth(), turkeyNow.getUTCDate() + 1)
  );
  // Convert back to UTC
  const todayEndUTC = new Date(todayMidnight.getTime() - turkeyOffset);

  // Find campaigns ending between now and midnight tonight
  const endingCampaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      lockedAt: null,
      endDate: {
        lte: todayEndUTC,
        gte: now,
      },
    },
    include: {
      submissions: {
        where: { status: "APPROVED" },
        select: { id: true, creatorId: true, insightiqContentId: true },
      },
    },
  });

  const results: Array<{
    campaignId: string;
    submissionCount: number;
    accountsRefreshed: number;
    refreshErrors: string[];
  }> = [];

  for (const campaign of endingCampaigns) {
    // 1. Lock campaign — no new submissions
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { lockedAt: new Date() },
    });

    // 2. Gather unique creator InsightIQ account IDs
    const accountIds = new Set<string>();
    for (const sub of campaign.submissions) {
      const user = await prisma.user.findUnique({
        where: { id: sub.creatorId },
        select: { tiktokUserId: true },
      });
      if (user?.tiktokUserId) {
        accountIds.add(user.tiktokUserId);
      }
    }

    // 3. Trigger on-demand refresh for each account
    const refreshErrors: string[] = [];
    for (const accountId of accountIds) {
      try {
        await triggerInsightIQRefresh(accountId);
        await prisma.metricFetchLog.create({
          data: {
            campaignId: campaign.id,
            source: "ON_DEMAND",
            status: "SUCCESS",
            errorMessage: `Triggered refresh for account ${accountId}`,
          },
        });
      } catch (error: any) {
        refreshErrors.push(`${accountId}: ${error.message}`);
        await prisma.metricFetchLog.create({
          data: {
            campaignId: campaign.id,
            source: "ON_DEMAND",
            status: "FAILED",
            errorMessage: `Failed refresh for account ${accountId}: ${error.message}`,
          },
        });
      }
    }

    results.push({
      campaignId: campaign.id,
      submissionCount: campaign.submissions.length,
      accountsRefreshed: accountIds.size,
      refreshErrors,
    });

    console.log(
      `[Pre-Distribute] Locked campaign ${campaign.id}: ${campaign.submissions.length} submissions, ${accountIds.size} accounts refreshed`
    );
  }

  return NextResponse.json({
    processed: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  // Allow admin to trigger manually
  return POST(req);
}
