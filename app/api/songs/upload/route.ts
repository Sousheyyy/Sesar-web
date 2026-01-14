import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { tiktokScraper } from "@/lib/tiktok-scraper";
import { extractTikTokMusicId } from "@/lib/url-utils";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== UserRole.ARTIST && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only artists can upload songs" },
        { status: 403 }
      );
    }

    const { tiktokUrl, description } = await req.json();

    if (!tiktokUrl) {
      return NextResponse.json(
        { error: "TikTok URL is required" },
        { status: 400 }
      );
    }

    // Validate TikTok URL format
    if (!tiktokUrl.includes("tiktok.com")) {
      return NextResponse.json(
        { error: "Invalid TikTok URL" },
        { status: 400 }
      );
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please log out and log in again." },
        { status: 404 }
      );
    }

    // Extract music ID from URL using centralized utility
    const musicId = extractTikTokMusicId(tiktokUrl);

    let songData;
    let musicInfo: Awaited<ReturnType<typeof tiktokScraper.fetchMusicInfo>> | null = null;

    // Fetch song details
    try {
      if (musicId) {
        // Optimization: If we have a music ID, fetch full info directly to avoid double calls
        // This gets us both the song details AND the stats (videoCount) in one request
        musicInfo = await tiktokScraper.fetchMusicInfo(musicId, true);
        songData = {
          title: musicInfo.title,
          duration: musicInfo.duration,
          coverImage: musicInfo.coverImage,
          tiktokUrl: musicInfo.tiktokUrl,
          authorName: musicInfo.authorName,
          isValid: musicInfo.isValid,
        };
        console.log("✅ Fetched music info directly:", { musicId, videoCount: musicInfo.videoCount });
      } else {
        // For video URLs, we need to scrape the video to get the song
        songData = await tiktokScraper.fetchSongDetails(tiktokUrl);
      }
    } catch (scrapeError: any) {
      // Handle TikAPI specific errors
      if (scrapeError.message?.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      if (scrapeError.message?.includes("not found") || scrapeError.message?.includes("invalid")) {
        return NextResponse.json(
          { error: "Could not find song at the provided TikTok URL. Please check the URL and try again." },
          { status: 400 }
        );
      }
      // Re-throw other errors
      throw scrapeError;
    }

    if (!songData.isValid) {
      return NextResponse.json(
        { error: "Could not fetch song details from TikTok" },
        { status: 400 }
      );
    }

    // If we scraped from a video URL, we might want to try to get enhanced stats if we found a musicId
    if (!musicInfo && songData.tiktokUrl) {
      const extractedId = extractTikTokMusicId(songData.tiktokUrl);
      if (extractedId) {
        try {
          musicInfo = await tiktokScraper.fetchMusicInfo(extractedId, true);
          console.log("✅ Fetched enhanced music info for video song:", { musicId: extractedId, videoCount: musicInfo.videoCount });
        } catch (infoError) {
          console.warn("Could not fetch enhanced music info:", infoError);
        }
      }
    }

    // Save song to database with enhanced statistics
    // Use the original tiktokUrl provided by the artist, not the reconstructed one
    const song = await prisma.song.create({
      data: {
        title: songData.title,
        description: description || null,
        tiktokUrl: tiktokUrl, // Use original URL from artist input
        duration: songData.duration,
        coverImage: songData.coverImage || null,
        artistId: user.id, // Use verified user.id instead of session.user.id
        // Enhanced fields from music info
        tiktokMusicId: musicInfo?.musicId || musicId,
        videoCount: musicInfo?.videoCount || null, // Number of videos using this music (from TikAPI)
        authorName: musicInfo?.authorName || songData.authorName,
        statsLastFetched: musicInfo ? new Date() : null,
      },
    });

    const response = NextResponse.json(song, { status: 201 });
    // Log API call
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      201,
      session.user.id
    );
    return response;
  } catch (error: any) {
    console.error("Song upload error:", error);
    const response = NextResponse.json(
      { error: error.message || "Failed to create song" },
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
    } catch { }
    return response;
  }
}

