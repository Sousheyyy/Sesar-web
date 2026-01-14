import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        balance: true,
        tiktokHandle: true,
        instagramHandle: true,
        youtubeHandle: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const response = NextResponse.json(user);
    // Log API call
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "GET",
      200,
      session.user.id
    );
    return response;
  } catch (error) {
    console.error("Profile fetch error:", error);
    const response = NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
    // Log API call error
    try {
      const session = await auth();
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "GET",
        500,
        session?.user?.id
      );
    } catch {}
    return response;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, bio, avatar, tiktokHandle, instagramHandle, youtubeHandle } = body;

    // Validate input
    const updateData: any = {};
    
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (bio !== undefined) {
      updateData.bio = typeof bio === "string" ? bio.trim() : null;
    }

    if (avatar !== undefined) {
      updateData.avatar = typeof avatar === "string" ? avatar.trim() : null;
    }

    if (tiktokHandle !== undefined) {
      // Remove @ if present and validate format
      const cleanHandle = typeof tiktokHandle === "string" 
        ? tiktokHandle.replace(/^@/, "").trim() 
        : null;
      
      if (cleanHandle && !/^[a-zA-Z0-9._]+$/.test(cleanHandle)) {
        return NextResponse.json(
          { error: "Invalid TikTok username format" },
          { status: 400 }
        );
      }
      updateData.tiktokHandle = cleanHandle || null;
    }

    if (instagramHandle !== undefined) {
      updateData.instagramHandle = typeof instagramHandle === "string" 
        ? instagramHandle.replace(/^@/, "").trim() || null 
        : null;
    }

    if (youtubeHandle !== undefined) {
      updateData.youtubeHandle = typeof youtubeHandle === "string" 
        ? youtubeHandle.trim() || null 
        : null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        balance: true,
        tiktokHandle: true,
        instagramHandle: true,
        youtubeHandle: true,
        createdAt: true,
      },
    });

    const response = NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
    // Log API call
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      200,
      session.user.id
    );
    return response;
  } catch (error) {
    console.error("Profile update error:", error);
    const response = NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
    // Log API call error
    try {
      const session = await auth();
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        500,
        session?.user?.id
      );
    } catch {}
    return response;
  }
}

