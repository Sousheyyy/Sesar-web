import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tiktokScraper } from "@/lib/tiktok-scraper";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const useCache = searchParams.get("cache") !== "false";

    // Validate limit
    if (limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: "Limit must be between 1 and 50" },
        { status: 400 }
      );
    }

    // Get the song to find the TikTok music ID
    const song = await prisma.song.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        tiktokMusicId: true,
      },
    });

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Check if we have a music ID
    if (!song.tiktokMusicId) {
      return NextResponse.json(
        { error: "No TikTok music ID available for this song" },
        { status: 400 }
      );
    }

    // Fetch trending videos using this music
    let posts;
    try {
      posts = await tiktokScraper.fetchMusicPosts(
        song.tiktokMusicId,
        limit,
        useCache
      );
    } catch (fetchError: any) {
      console.error("Error fetching music posts:", fetchError);
      if (fetchError.message?.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch trending videos" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      songId: song.id,
      songTitle: song.title,
      tiktokMusicId: song.tiktokMusicId,
      posts,
      count: posts.length,
    });
  } catch (error: any) {
    console.error("Music posts fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trending videos" },
      { status: 500 }
    );
  }
}







