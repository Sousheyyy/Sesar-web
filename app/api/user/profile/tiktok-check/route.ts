import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

// This endpoint is deprecated - users must now connect via TikTok OAuth
// Profile data is automatically synced when they connect their TikTok account
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const session = await auth();

    if (!session?.user) {
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

    const duration = Date.now() - startTime;
    const response = NextResponse.json(
      { 
        error: "This endpoint is deprecated. Please connect your TikTok account via OAuth to automatically sync your profile.",
        requiresOAuth: true
      },
      { status: 410 }
    );
    
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      410,
      session.user.id,
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
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      500,
      null,
      duration
    );
    return response;
  }
}

