import 'server-only';

// ─── InsightIQ (formerly Phyllo) shared helpers ───────────────────────
// Lazy getters — avoid module-init-time process.env reads on Workers
export const getInsightIQBaseUrl = () =>
  process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";

export const TIKTOK_WORK_PLATFORM_ID = "de55aeec-0dc8-4119-bf90-16b3d1f0c987";

export const getInsightIQAuthHeader = () => {
  const id = process.env.INSIGHTIQ_CLIENT_ID;
  const secret = process.env.INSIGHTIQ_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing INSIGHTIQ_CLIENT_ID or INSIGHTIQ_CLIENT_SECRET");
  // Use btoa() for Workers compatibility (Buffer also works with nodejs_compat)
  const encoded = typeof Buffer !== 'undefined'
    ? Buffer.from(`${id}:${secret}`).toString("base64")
    : btoa(`${id}:${secret}`);
  return `Basic ${encoded}`;
};

export async function insightiqFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${getInsightIQBaseUrl()}${path}`, {
    ...opts,
    headers: {
      Authorization: getInsightIQAuthHeader(),
      "Content-Type": "application/json",
      ...((opts.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`InsightIQ ${res.status} [${path}]:`, body);
    throw new Error(`InsightIQ ${res.status}: ${body.substring(0, 300)}`);
  }
  return res.json();
}

/**
 * Fetch video content data from InsightIQ using public content fetch.
 * This is a synchronous endpoint — no polling needed.
 * Uses url + work_platform_id (TikTok), does NOT require account_id.
 */
/**
 * Trigger on-demand content refresh for an InsightIQ account.
 * InsightIQ will send back CONTENTS.UPDATED webhook with updated metrics.
 */
export async function triggerInsightIQRefresh(accountId: string): Promise<void> {
  await insightiqFetch("/v1/social/contents/refresh", {
    method: "POST",
    body: JSON.stringify({ account_id: accountId }),
  });
}

export async function fetchVideoViaInsightIQ(tiktokUrl: string): Promise<any> {
  const response = await insightiqFetch(
    "/v1/social/creators/contents/fetch",
    {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: JSON.stringify({
        content_url: tiktokUrl,
        work_platform_id: TIKTOK_WORK_PLATFORM_ID,
      })
    }
  );

  if (!response.data || response.data.length === 0) {
    throw new Error("İçerik alınamadı. Video herkese açık olmalıdır.");
  }

  return response.data[0];
}
