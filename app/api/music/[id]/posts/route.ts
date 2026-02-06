import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

/**
 * Get trending posts for a music track
 * GET /api/music/[id]/posts
 * 
 * Note: This endpoint is currently limited - trending posts feature 
 * requires TikTok Marketing API which needs separate approval from TikTok.
 * Returns song metadata without trending posts for now.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get the song
    const song = await prisma.song.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        tiktokMusicId: true,
        authorName: true,
        musicCoverUrl: true,
        videoCount: true,
      },
    });

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Return song metadata with empty posts array
    // Trending posts feature requires Marketing API approval
    return NextResponse.json({
      songId: song.id,
      songTitle: song.title,
      tiktokMusicId: song.tiktokMusicId,
      authorName: song.authorName,
      coverUrl: song.musicCoverUrl,
      videoCount: song.videoCount,
      posts: [],
      count: 0,
      message: "Trending posts feature is currently unavailable. This requires TikTok Marketing API approval.",
    });
  } catch (error: any) {
    console.error("[Music Posts] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch song data" },
      { status: 500 }
    );
  }
}



