/**
 * GET /api/tiktok/callback
 *
 * Public endpoint — TikTok redirects here after OAuth authorization.
 * Exchanges the code for tokens, fetches user profile, updates DB,
 * and redirects to the mobile deep link sesar://auth/tiktok-callback.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptBankDetails } from "@/server/lib/encryption";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MOBILE_DEEP_LINK = "sesar://auth/tiktok-callback";

function verifyState(
  stateStr: string,
  secret: string
): { userId: string; nonce: string; exp: number } | null {
  try {
    const [data, hmac] = stateStr.split(".");
    if (!data || !hmac) return null;

    const expectedHmac = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    if (hmac !== expectedHmac) return null;

    const payload = JSON.parse(Buffer.from(data, "base64url").toString());

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle TikTok error (user denied, etc.)
  if (error) {
    return NextResponse.redirect(
      `${MOBILE_DEEP_LINK}?status=error&error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${MOBILE_DEEP_LINK}?status=error&error=missing_params`
    );
  }

  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientSecret) {
    console.error("[TikTok Callback] Missing TIKTOK_CLIENT_SECRET");
    return NextResponse.redirect(
      `${MOBILE_DEEP_LINK}?status=error&error=server_error`
    );
  }

  // 1. Verify state HMAC and expiry
  const statePayload = verifyState(state, clientSecret);
  if (!statePayload) {
    return NextResponse.redirect(
      `${MOBILE_DEEP_LINK}?status=error&error=invalid_state`
    );
  }

  const { userId } = statePayload;

  try {
    // 2. Exchange code for tokens
    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI!;

    const tokenRes = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[TikTok Callback] Token exchange failed:", body);
      return NextResponse.redirect(
        `${MOBILE_DEEP_LINK}?status=error&error=token_exchange_failed`
      );
    }

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[TikTok Callback] Token error:", tokenData);
      return NextResponse.redirect(
        `${MOBILE_DEEP_LINK}?status=error&error=${encodeURIComponent(tokenData.error)}`
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // seconds
    const openId = tokenData.open_id;

    if (!accessToken || !openId) {
      console.error("[TikTok Callback] Missing access_token or open_id");
      return NextResponse.redirect(
        `${MOBILE_DEEP_LINK}?status=error&error=invalid_token_response`
      );
    }

    // 3. Fetch user profile
    const profileRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/" +
        "?fields=open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let profileData: any = {};
    if (profileRes.ok) {
      const profileJson = await profileRes.json();
      profileData = profileJson.data?.user || {};
    } else {
      console.warn("[TikTok Callback] Profile fetch failed, continuing with token data");
    }

    // 4. Encrypt access token
    const encryptedAccessToken = encryptBankDetails(accessToken);
    const encryptedRefreshToken = refreshToken
      ? encryptBankDetails(refreshToken)
      : null;

    // 5. Update user in DB
    const followerCount = profileData.follower_count ?? 0;

    await prisma.user.update({
      where: { id: userId },
      data: {
        tiktok_open_id: openId,
        tiktok_access_token: encryptedAccessToken,
        tiktok_refresh_token: encryptedRefreshToken,
        tiktok_token_expires_at: expiresIn
          ? new Date(Date.now() + expiresIn * 1000)
          : null,
        tiktok_scopes: "user.info.basic,user.info.profile,user.info.stats",
        tiktokHandle: profileData.username || profileData.display_name || null,
        tiktokUsername: profileData.username || null,
        tiktokDisplayName: profileData.display_name || null,
        tiktokAvatarUrl: profileData.avatar_url || null,
        followerCount,
        followingCount: profileData.following_count ?? 0,
        totalLikes: profileData.likes_count ?? 0,
        videoCount: profileData.video_count ?? 0,
        lastStatsFetchedAt: new Date(),
        tiktokConnectedAt: new Date(),
        ...(profileData.avatar_url ? { avatar: profileData.avatar_url } : {}),
      },
    });

    console.log(`[TikTok Callback] User ${userId} connected TikTok: @${profileData.username || profileData.display_name}`);

    // 6. Redirect to mobile deep link
    return NextResponse.redirect(`${MOBILE_DEEP_LINK}?status=success`);
  } catch (error) {
    console.error("[TikTok Callback] Error:", error);
    return NextResponse.redirect(
      `${MOBILE_DEEP_LINK}?status=error&error=server_error`
    );
  }
}
