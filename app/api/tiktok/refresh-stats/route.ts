/**
 * POST /api/tiktok/refresh-stats
 *
 * Protected endpoint — requires Supabase auth JWT in Authorization header.
 * Refreshes the user's TikTok stats (followers, likes, videos, etc.)
 * using stored encrypted tokens. Refreshes token if expired.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decryptBankDetails, encryptBankDetails } from "@/server/lib/encryption";

export const dynamic = "force-dynamic";

// Rate limit: 1 request per 10 minutes per user
const MIN_INTERVAL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Supabase auth
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;

    // 2. Fetch user's TikTok tokens
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tiktok_open_id: true,
        tiktok_access_token: true,
        tiktok_refresh_token: true,
        tiktok_token_expires_at: true,
        lastStatsFetchedAt: true,
      },
    });

    if (!user || !user.tiktok_open_id || !user.tiktok_access_token) {
      return NextResponse.json(
        { error: "TikTok hesabınız bağlı değil." },
        { status: 400 }
      );
    }

    // 3. Server-side rate limit
    if (user.lastStatsFetchedAt) {
      const elapsed = Date.now() - new Date(user.lastStatsFetchedAt).getTime();
      if (elapsed < MIN_INTERVAL_MS) {
        const remainingMin = Math.ceil((MIN_INTERVAL_MS - elapsed) / 60000);
        return NextResponse.json(
          { error: `Lütfen ${remainingMin} dakika sonra tekrar deneyin.` },
          { status: 429 }
        );
      }
    }

    // 4. Decrypt access token
    let accessToken: string;
    try {
      accessToken = decryptBankDetails(user.tiktok_access_token);
    } catch {
      return NextResponse.json(
        { error: "Token çözülemedi. Lütfen TikTok'u yeniden bağlayın." },
        { status: 500 }
      );
    }

    // 5. Check if token expired — refresh if needed
    const tokenExpired =
      user.tiktok_token_expires_at &&
      new Date(user.tiktok_token_expires_at) < new Date();

    if (tokenExpired && user.tiktok_refresh_token) {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

      if (!clientKey || !clientSecret) {
        return NextResponse.json(
          { error: "Server yapılandırma hatası." },
          { status: 500 }
        );
      }

      let refreshToken: string;
      try {
        refreshToken = decryptBankDetails(user.tiktok_refresh_token);
      } catch {
        return NextResponse.json(
          { error: "Refresh token çözülemedi. Lütfen TikTok'u yeniden bağlayın." },
          { status: 500 }
        );
      }

      const tokenRes = await fetch(
        "https://open.tiktokapis.com/v2/oauth/token/",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        }
      );

      if (!tokenRes.ok) {
        return NextResponse.json(
          { error: "Token yenilenemedi. Lütfen TikTok'u yeniden bağlayın." },
          { status: 401 }
        );
      }

      const tokenData = await tokenRes.json();

      if (tokenData.error || !tokenData.access_token) {
        return NextResponse.json(
          { error: "Token yenilenemedi. Lütfen TikTok'u yeniden bağlayın." },
          { status: 401 }
        );
      }

      // Update tokens
      accessToken = tokenData.access_token;
      const newEncryptedAccess = encryptBankDetails(tokenData.access_token);
      const newEncryptedRefresh = tokenData.refresh_token
        ? encryptBankDetails(tokenData.refresh_token)
        : user.tiktok_refresh_token;

      await prisma.user.update({
        where: { id: userId },
        data: {
          tiktok_access_token: newEncryptedAccess,
          tiktok_refresh_token: newEncryptedRefresh,
          tiktok_token_expires_at: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
        },
      });
    }

    // 6. Fetch fresh stats from TikTok
    const profileRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/" +
        "?fields=open_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!profileRes.ok) {
      return NextResponse.json(
        { error: "TikTok istatistikleri alınamadı." },
        { status: 502 }
      );
    }

    const profileJson = await profileRes.json();
    const profileData = profileJson.data?.user || {};

    // 7. Update user stats in DB
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        followerCount: profileData.follower_count ?? undefined,
        followingCount: profileData.following_count ?? undefined,
        totalLikes: profileData.likes_count ?? undefined,
        videoCount: profileData.video_count ?? undefined,
        tiktokHandle: profileData.username || profileData.display_name || undefined,
        tiktokUsername: profileData.username || undefined,
        tiktokDisplayName: profileData.display_name || undefined,
        lastStatsFetchedAt: new Date(),
        ...(profileData.avatar_url ? { avatar: profileData.avatar_url, tiktokAvatarUrl: profileData.avatar_url } : {}),
      },
      select: {
        followerCount: true,
        followingCount: true,
        totalLikes: true,
        videoCount: true,
        tiktokHandle: true,
        avatar: true,
        lastStatsFetchedAt: true,
      },
    });

    console.log(
      `[TikTok Refresh] User ${userId} stats refreshed: ${updatedUser.followerCount} followers`
    );

    return NextResponse.json({
      success: true,
      stats: updatedUser,
    });
  } catch (error) {
    console.error("[TikTok Refresh Stats] Error:", error);
    return NextResponse.json(
      { error: "İstatistikler güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
