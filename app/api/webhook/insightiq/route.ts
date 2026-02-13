import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CalculationService } from "@/server/services/calculationService";

export const dynamic = "force-dynamic";

// InsightIQ production IPs
const ALLOWED_IPS_PRODUCTION = ["3.211.223.93", "44.216.173.40"];
const ALLOWED_IPS_SANDBOX = ["54.211.40.75", "3.82.72.201"];

// =========================================================================
// Security helpers
// =========================================================================

function verifySignature(rawBody: string, signaturesHeader: string): boolean {
  const secret = process.env.INSIGHTIQ_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook] INSIGHTIQ_WEBHOOK_SECRET not configured");
    return false;
  }

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const receivedSigs = signaturesHeader.split(",").map((s) => s.trim());

  return receivedSigs.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig, "hex"),
        Buffer.from(sig, "hex")
      );
    } catch {
      return false;
    }
  });
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

function isAllowedIP(ip: string): boolean {
  const isProduction = process.env.NODE_ENV === "production";
  const allowedIPs = isProduction
    ? ALLOWED_IPS_PRODUCTION
    : [...ALLOWED_IPS_SANDBOX, ...ALLOWED_IPS_PRODUCTION, "127.0.0.1", "::1"];
  return allowedIPs.includes(ip);
}

// =========================================================================
// Types
// =========================================================================

interface WebhookPayload {
  event: string;
  name: string;
  id: string;
  data: {
    account_id?: string;
    user_id?: string;
    profile_id?: string;
    job_id?: string;
    items?: string[];
    last_updated_time?: string;
  };
}

// =========================================================================
// POST /api/webhook/insightiq
// =========================================================================

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);

  // IP verification (production only — relaxed in dev)
  if (process.env.NODE_ENV === "production" && !isAllowedIP(ip)) {
    console.warn(`[Webhook] Rejected request from IP: ${ip}`);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();

  // Signature verification
  const signatures = req.headers.get("Webhook-Signatures") || "";
  if (signatures && !verifySignature(rawBody, signatures)) {
    console.warn("[Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse payload
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.event || !payload.id) {
    return NextResponse.json({ error: "Missing event or id" }, { status: 400 });
  }

  // Respond 200 immediately (InsightIQ 5-second timeout)
  // then process async
  processWebhookAsync(payload).catch((err) => {
    console.error("[Webhook] Async processing error:", err);
  });

  return NextResponse.json({ received: true }, { status: 200 });
}

// =========================================================================
// Async webhook processing
// =========================================================================

async function processWebhookAsync(payload: WebhookPayload) {
  const { event, id: webhookId, data } = payload;

  console.log(`[Webhook] Processing event: ${event}, id: ${webhookId}`);

  switch (event) {
    case "CONTENTS.UPDATED":
    case "CONTENTS.ADDED":
      await handleContentsUpdated(webhookId, data);
      break;

    case "CONTENTS_FETCH.SUCCESS":
      await handleContentsFetchSuccess(webhookId, data);
      break;

    case "CONTENTS_FETCH.FAILURE":
      await handleContentsFetchFailure(webhookId, data);
      break;

    case "SESSION.EXPIRED":
      await handleSessionExpired(data);
      break;

    default:
      console.log(`[Webhook] Ignoring unhandled event: ${event}`);
      break;
  }
}

// =========================================================================
// CONTENTS.UPDATED / CONTENTS.ADDED handler
// =========================================================================

async function handleContentsUpdated(
  webhookId: string,
  data: WebhookPayload["data"]
) {
  // Idempotency check
  const existing = await prisma.metricFetchLog.findFirst({
    where: { webhookEventId: webhookId },
  });
  if (existing) {
    console.log(`[Webhook] Duplicate webhook ${webhookId}, skipping`);
    return;
  }

  const items = data.items || [];
  if (items.length === 0) return;

  // Match content IDs to our submissions in active, non-locked campaigns
  const submissions = await prisma.submission.findMany({
    where: {
      insightiqContentId: { in: items },
      status: "APPROVED",
      campaign: {
        status: "ACTIVE",
        lockedAt: null,
      },
    },
    include: { campaign: true },
  });

  if (submissions.length === 0) {
    console.log(`[Webhook] No matching submissions for ${items.length} content IDs`);
    return;
  }

  // Bulk-fetch updated metrics from InsightIQ
  const updatedMetrics = await fetchContentItemsBulk(items);

  const affectedCampaignIds = new Set<string>();

  for (const submission of submissions) {
    const metrics = updatedMetrics.get(submission.insightiqContentId || "");

    if (!metrics) {
      await prisma.metricFetchLog.create({
        data: {
          campaignId: submission.campaignId,
          submissionId: submission.id,
          source: "WEBHOOK",
          status: "SKIPPED",
          errorMessage: "Content ID not found in bulk fetch response",
          webhookEventId: webhookId,
        },
      });
      continue;
    }

    const views = metrics.views || 0;
    const likes = metrics.likes || 0;
    const shares = metrics.shares || 0;
    const comments = metrics.comments || 0;
    const points = CalculationService.calculatePoints(views, likes, shares);

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        lastViewCount: views,
        lastLikeCount: likes,
        lastShareCount: shares,
        lastCommentCount: comments,
        viewPoints: points.viewPoints,
        likePoints: points.likePoints,
        sharePoints: points.sharePoints,
        totalPoints: points.totalPoints,
        lastCheckedAt: new Date(),
      },
    });

    await prisma.metricFetchLog.create({
      data: {
        campaignId: submission.campaignId,
        submissionId: submission.id,
        source: "WEBHOOK",
        status: "SUCCESS",
        metricsSnapshot: { views, likes, shares, comments, ...points },
        webhookEventId: webhookId,
      },
    });

    affectedCampaignIds.add(submission.campaignId);
  }

  // Recalculate affected campaigns (full Robin Hood)
  for (const campaignId of affectedCampaignIds) {
    try {
      await CalculationService.updateCampaignTotalPoints(campaignId, prisma);
      await CalculationService.recalculateCampaignSubmissions(campaignId, prisma);
    } catch (err) {
      console.error(`[Webhook] Recalc failed for campaign ${campaignId}:`, err);
    }
  }

  console.log(
    `[Webhook] Processed ${submissions.length} submissions across ${affectedCampaignIds.size} campaigns`
  );
}

// =========================================================================
// CONTENTS_FETCH handlers (for on-demand refresh results)
// =========================================================================

async function handleContentsFetchSuccess(
  webhookId: string,
  data: WebhookPayload["data"]
) {
  console.log(`[Webhook] Content fetch success, job_id: ${data.job_id}`);
  // On-demand refresh completed — the CONTENTS.UPDATED webhook will follow
  // with the actual updated content IDs. This is just an acknowledgment.
}

async function handleContentsFetchFailure(
  webhookId: string,
  data: WebhookPayload["data"]
) {
  console.error(`[Webhook] Content fetch failure, job_id: ${data.job_id}`);

  await prisma.metricFetchLog.create({
    data: {
      campaignId: "SYSTEM",
      source: "ON_DEMAND",
      status: "FAILED",
      errorMessage: `InsightIQ content fetch failed for job ${data.job_id}`,
      webhookEventId: webhookId,
    },
  });
}

// =========================================================================
// SESSION.EXPIRED handler
// =========================================================================

async function handleSessionExpired(data: WebhookPayload["data"]) {
  const accountId = data.account_id;
  if (!accountId) return;

  // tiktokUserId stores the InsightIQ account ID
  const user = await prisma.user.findFirst({
    where: { tiktokUserId: accountId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { insightiqSessionExpired: true },
    });
    console.log(`[Webhook] SESSION.EXPIRED for user ${user.id} (account ${accountId})`);
  }
}

// =========================================================================
// InsightIQ API helpers
// =========================================================================

interface ContentMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
}

/**
 * Fetch content items in bulk from InsightIQ.
 * Returns a Map of insightiqContentId -> engagement metrics.
 */
async function fetchContentItemsBulk(
  contentIds: string[]
): Promise<Map<string, ContentMetrics>> {
  const result = new Map<string, ContentMetrics>();
  const baseUrl = process.env.INSIGHTIQ_BASE_URL || "https://api.insightiq.ai";
  const apiKey = process.env.INSIGHTIQ_API_KEY;
  const apiSecret = process.env.INSIGHTIQ_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("[Webhook] InsightIQ API credentials not configured");
    return result;
  }

  const authHeader = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  // Fetch in chunks of 50 (InsightIQ limit per request)
  const CHUNK_SIZE = 50;
  for (let i = 0; i < contentIds.length; i += CHUNK_SIZE) {
    const chunk = contentIds.slice(i, i + CHUNK_SIZE);

    try {
      const res = await fetch(`${baseUrl}/v1/social/contents?ids=${chunk.join(",")}`, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error(`[Webhook] Bulk fetch failed: ${res.status} ${await res.text()}`);
        continue;
      }

      const data = await res.json();
      const items = data.data || data.contents || data || [];

      for (const item of Array.isArray(items) ? items : []) {
        const id = item.id || item.content_id;
        const engagement = item.engagement || item.statistics || {};

        result.set(id, {
          views: engagement.view_count || engagement.views || 0,
          likes: engagement.like_count || engagement.likes || 0,
          shares: engagement.share_count || engagement.shares || 0,
          comments: engagement.comment_count || engagement.comments || 0,
        });
      }
    } catch (err) {
      console.error("[Webhook] Bulk fetch error:", err);
    }
  }

  return result;
}

/**
 * Trigger on-demand refresh for an InsightIQ account.
 * Used by the pre-distribute cron at 23:00.
 */
export async function triggerInsightIQRefresh(accountId: string): Promise<void> {
  const baseUrl = process.env.INSIGHTIQ_BASE_URL || "https://api.insightiq.ai";
  const apiKey = process.env.INSIGHTIQ_API_KEY;
  const apiSecret = process.env.INSIGHTIQ_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("InsightIQ API credentials not configured");
  }

  const authHeader = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const res = await fetch(`${baseUrl}/v1/social/contents/refresh`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ account_id: accountId }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`InsightIQ refresh failed (${res.status}): ${body}`);
  }
}
