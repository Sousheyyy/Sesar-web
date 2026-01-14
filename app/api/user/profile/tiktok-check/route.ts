import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tiktokScraper } from "@/lib/tiktok-scraper";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let statusCode = 500;
  let userId: string | null = null;
  
  try {
    const session = await auth();

    if (!session?.user) {
      statusCode = 401;
      const duration = Date.now() - startTime;
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        401,
        null,
        duration
      );
      return response;
    }
    
    userId = session.user.id;

    const { username, autoUpdate } = await req.json();

    if (!username || typeof username !== "string") {
      statusCode = 400;
      const duration = Date.now() - startTime;
      const response = NextResponse.json(
        { error: "Kullanıcı adı gereklidir" },
        { status: 400 }
      );
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        400,
        userId,
        duration
      );
      return response;
    }

    // Remove @ if present
    const cleanUsername = username.replace(/^@/, "").trim();

    if (!cleanUsername) {
      statusCode = 400;
      const duration = Date.now() - startTime;
      const response = NextResponse.json(
        { error: "Kullanıcı adı boş olamaz" },
        { status: 400 }
      );
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        400,
        userId,
        duration
      );
      return response;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
      statusCode = 400;
      const duration = Date.now() - startTime;
      const response = NextResponse.json(
        { error: "Geçersiz TikTok kullanıcı adı formatı. Sadece harf, rakam, nokta ve alt çizgi kullanılabilir." },
        { status: 400 }
      );
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        400,
        userId,
        duration
      );
      return response;
    }

    // Check TikTok profile
    let profileData;
    try {
      profileData = await tiktokScraper.checkUserProfile(cleanUsername);
    } catch (error: any) {
      // Handle specific error cases
      if (error.message?.includes("not found")) {
        statusCode = 404;
        const duration = Date.now() - startTime;
        const response = NextResponse.json(
          { error: "TikTok kullanıcısı bulunamadı. Lütfen kullanıcı adını kontrol edip tekrar deneyin." },
          { status: 404 }
        );
        logApiCallSimple(
          extractEndpoint(new URL(req.url).pathname),
          "POST",
          404,
          userId,
          duration
        );
        return response;
      }
      if (error.message?.includes("Rate limit")) {
        statusCode = 429;
        const duration = Date.now() - startTime;
        const response = NextResponse.json(
          { error: "İstek limiti aşıldı. Lütfen daha sonra tekrar deneyin." },
          { status: 429 }
        );
        logApiCallSimple(
          extractEndpoint(new URL(req.url).pathname),
          "POST",
          429,
          userId,
          duration
        );
        return response;
      }
      if (error.message?.includes("Invalid")) {
        statusCode = 400;
        const duration = Date.now() - startTime;
        const response = NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
        logApiCallSimple(
          extractEndpoint(new URL(req.url).pathname),
          "POST",
          400,
          userId,
          duration
        );
        return response;
      }
      
      // Generic error
      statusCode = 500;
      const duration = Date.now() - startTime;
      const response = NextResponse.json(
        { error: "TikTok profili alınamadı. Lütfen daha sonra tekrar deneyin." },
        { status: 500 }
      );
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        500,
        userId,
        duration
      );
      return response;
    }

    if (!profileData.isValid) {
      statusCode = 400;
      const duration = Date.now() - startTime;
      const response = NextResponse.json(
        { error: "Geçersiz TikTok profil verisi" },
        { status: 400 }
      );
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        400,
        userId,
        duration
      );
      return response;
    }

    // Auto-update user's TikTok handle if requested
    if (autoUpdate === true) {
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { tiktokHandle: cleanUsername },
        });
      } catch (updateError) {
        console.error("Failed to auto-update TikTok handle:", updateError);
        // Don't fail the request if auto-update fails
      }
    }

    statusCode = 200;
    const duration = Date.now() - startTime;
    const response = NextResponse.json({
      success: true,
      profile: profileData,
      username: cleanUsername,
    });
    // Log API call
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      200,
      userId,
      duration
    );
    return response;
  } catch (error) {
    console.error("TikTok check error:", error);
    const duration = Date.now() - startTime;
    const response = NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
    // Log API call error
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      500,
      userId,
      duration
    );
    return response;
  }
}

