import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { tiktokScraper } from "@/lib/tiktok-scraper";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the song
    const song = await prisma.song.findUnique({
      where: { id: params.id },
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

    // Check if we have a music ID
    if (!song.tiktokMusicId) {
      return NextResponse.json(
        { error: "No TikTok music ID available for this song" },
        { status: 400 }
      );
    }

    // Fetch fresh music info from TikAPI (bypass cache)
    let musicInfo;
    try {
      musicInfo = await tiktokScraper.fetchMusicInfo(song.tiktokMusicId, false);
    } catch (fetchError: any) {
      console.error("Error fetching music info:", fetchError);
      if (fetchError.message?.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch music statistics" },
        { status: 500 }
      );
    }

    // Update song with fresh statistics
    const updatedSong = await prisma.song.update({
      where: { id: params.id },
      data: {
        videoCount: musicInfo.videoCount || null, // Number of videos using this music
        authorName: musicInfo.authorName,
        statsLastFetched: new Date(),
      },
    });

    return NextResponse.json({
      id: updatedSong.id,
      title: updatedSong.title,
      videoCount: updatedSong.videoCount,
      authorName: updatedSong.authorName,
      statsLastFetched: updatedSong.statsLastFetched,
    });
  } catch (error: any) {
    console.error("Stats refresh error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refresh statistics" },
      { status: 500 }
    );
  }
}

