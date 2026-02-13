import { NextRequest, NextResponse } from "next/server";
import { processEndedCampaigns } from "@/lib/payout";

export const dynamic = "force-dynamic";

/**
 * Cron: Final Distribution
 * Schedule: Daily at 00:15 Europe/Istanbul (UTC+3) — 15 min buffer for webhooks
 *
 * Finds locked campaigns that have ended and processes final distribution:
 * insurance check → eligibility filter → Robin Hood → wallet payouts.
 */
export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Distribute] Starting final distribution cron...");

  const result = await processEndedCampaigns();

  console.log(
    `[Distribute] Done: ${result.processed} processed, ${result.failed} failed`
  );

  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
