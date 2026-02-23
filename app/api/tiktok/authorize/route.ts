/**
 * GET /api/tiktok/authorize
 *
 * Protected endpoint — requires Supabase auth JWT in Authorization header.
 * Returns a TikTok OAuth URL with a signed state token containing the userId.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function signState(payload: object, secret: string): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${hmac}`;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Supabase auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Build signed state token
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !clientSecret || !redirectUri) {
      console.error("Missing TikTok OAuth environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const statePayload = {
      userId: user.id,
      nonce: crypto.randomUUID(),
      exp: Math.floor(Date.now() / 1000) + 600, // 10 min expiry
    };

    const state = signState(statePayload, clientSecret);

    // 3. Build TikTok OAuth URL
    const scope = "user.info.basic,user.info.profile,user.info.stats";
    const authUrl =
      `https://www.tiktok.com/v2/auth/authorize/` +
      `?client_key=${clientKey}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("[TikTok Authorize] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate auth URL" },
      { status: 500 }
    );
  }
}
