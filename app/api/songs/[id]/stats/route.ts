import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the song
    const song = await prisma.song.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        tiktokMusicId: true,
        videoCount: true,
        authorName: true,
        statsLastFetched: true,
        artistId: true,
      },
    });

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Only the artist or admin can refresh stats
    if (
      session.user.role !== UserRole.ADMIN &&
      song.artistId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Unauthorized to refresh stats for this song" },
        { status: 403 }
      );
    }

    // Stats refresh feature is disabled - requires TikTok Marketing API
    // Just return the current song data without refreshing
    return NextResponse.json({
      id: song.id,
      title: song.title,
      videoCount: song.videoCount,
      authorName: song.authorName,
      statsLastFetched: song.statsLastFetched,
      message: "Stats refresh is currently unavailable. This requires TikTok Marketing API approval.",
    });
  } catch (error: any) {
    console.error("Stats refresh error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refresh statistics" },
      { status: 500 }
    );
  }
}

