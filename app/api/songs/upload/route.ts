/**
 * Song Upload with InsightIQ Integration
 * POST /api/songs/upload
 * 
 * Artist uploads song by providing a TikTok VIDEO URL that uses their song.
 * InsightIQ API fetches the video content and extracts music metadata
 * (song name, artist name, cover art).
 * 
 * Note: Music page URLs (tiktok.com/music/...) are NOT supported because
 * InsightIQ/Phyllo doesn't have a direct music metadata API endpoint.
 * Video URLs work because we can extract audio_track_info from the video content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { insightIQClient } from '@/lib/insightiq/client';
import {
  isTikTokMusicUrl,
  isTikTokVideoUrl,
  normalizeTikTokUrl,
} from '@/lib/insightiq/url-utils';
import { AudioTrackInfo } from '@/lib/insightiq/types';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if InsightIQ is configured
    if (!insightIQClient.isInsightIQConfigured()) {
      return NextResponse.json(
        {
          error: 'Service not configured',
          message: 'InsightIQ API is not configured. Please contact support.',
        },
        { status: 503 }
      );
    }

    const { tiktokUrl } = await req.json();

    if (!tiktokUrl) {
      return NextResponse.json(
        { error: 'TikTok URL is required' },
        { status: 400 }
      );
    }

    // Normalize URL (handle mobile variants)
    const normalizedUrl = normalizeTikTokUrl(tiktokUrl);

    // Determine URL type
    const isVideoUrl = isTikTokVideoUrl(normalizedUrl);
    const isMusicUrl = isTikTokMusicUrl(normalizedUrl);

    if (!isVideoUrl && !isMusicUrl) {
      return NextResponse.json(
        {
          error: 'Invalid TikTok URL',
          message: 'Please provide a valid TikTok video URL (e.g., tiktok.com/@user/video/123)',
        },
        { status: 400 }
      );
    }

    // Recommend video URLs for best results
    if (isMusicUrl) {
      return NextResponse.json(
        {
          error: 'Music URL not supported',
          message: 'Lütfen şarkınızı kullanan bir TikTok video linki yapıştırın. Video linkinden şarkı bilgileri otomatik olarak çekilecektir. Örn: tiktok.com/@user/video/123',
          hint: 'video_url_required',
        },
        { status: 400 }
      );
    }

    let musicId: string | null = null;
    let musicData: AudioTrackInfo | null = null;
    let thumbnailUrl: string | null = null;
    let videoCount = 0;

    // Video URL - fetch video content via InsightIQ API
    console.log('[Song Upload] Processing video URL via InsightIQ...');

    try {
      const videoContent = await insightIQClient.fetchContentByUrl(normalizedUrl);

      console.log('[Song Upload] Video content fetched:', JSON.stringify(videoContent, null, 2));

      if (!videoContent.audio_track_info) {
        return NextResponse.json(
          {
            error: 'No music found',
            message: 'Bu videoda tanımlanabilir bir müzik parçası bulunamadı. Lütfen şarkı içeren başka bir video deneyin.',
          },
          { status: 400 }
        );
      }

      musicData = videoContent.audio_track_info;
      musicId = musicData.id;
      // Use thumbnail_url from video as cover since audio_track_info may not have cover_url
      thumbnailUrl = musicData.cover_url || videoContent.thumbnail_url;
      videoCount = videoContent.engagement?.view_count ? 1 : 1;

      console.log(`[Song Upload] Music extracted from video:`, {
        title: musicData.title,
        artist: musicData.artist,
        musicId: musicId,
        thumbnailUrl: thumbnailUrl,
      });
    } catch (fetchError: any) {
      console.error('[Song Upload] Error fetching video content:', fetchError);
      return NextResponse.json(
        {
          error: 'Could not fetch video',
          message: 'Video bilgileri alınamadı. Lütfen URL\'yi kontrol edip tekrar deneyin.',
          details: fetchError.message,
        },
        { status: 400 }
      );
    }

    if (!musicId || !musicData) {
      return NextResponse.json(
        {
          error: 'Could not extract music information',
          message: 'Unable to get music metadata from the provided URL.',
        },
        { status: 400 }
      );
    }

    // Check if song already exists
    const existingSong = await prisma.song.findUnique({
      where: { tiktokMusicId: musicId },
    });

    if (existingSong) {
      // Return existing song if it belongs to this user
      if (existingSong.artistId === session.user.id) {
        return NextResponse.json({
          success: true,
          song: existingSong,
          videoCount: existingSong.videoCount || 0,
          message: 'Song already exists in your library',
          existing: true,
        });
      }

      return NextResponse.json(
        {
          error: 'Song already exists',
          message: 'This song has already been added by another artist',
          song: {
            id: existingSong.id,
            title: existingSong.title,
            authorName: existingSong.authorName,
          },
        },
        { status: 409 }
      );
    }

    console.log(`[Song Upload] Creating song: ${musicData.title} by ${musicData.artist}`);

    // Create song in database
    const song = await prisma.song.create({
      data: {
        title: musicData.title,
        authorName: musicData.artist,
        coverImage: musicData.cover_url || thumbnailUrl || null,
        tiktokUrl: normalizedUrl,
        tiktokMusicId: musicId,
        musicCoverUrl: musicData.cover_url || null,
        musicUrl: musicData.url || normalizedUrl,
        duration: musicData.duration || null,
        videoCount: videoCount || null,
        statsLastFetched: new Date(),
        artist: {
          connect: { id: session.user.id },
        },
      },
    });

    console.log(`[Song Upload] Song created successfully: ${song.id}`);

    return NextResponse.json({
      success: true,
      song,
      videoCount,
      message: `Song "${musicData.title}" by ${musicData.artist} added successfully`,
    });
  } catch (error) {
    console.error('[Song Upload] Error:', error);

    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('not connected')) {
        return NextResponse.json(
          {
            error: 'TikTok not connected',
            message: 'Please connect your TikTok account first',
            requiresConnection: true,
          },
          { status: 403 }
        );
      }

      if (error.message.includes('InsightIQ API Error')) {
        return NextResponse.json(
          {
            error: 'API Error',
            message: error.message,
          },
          { status: 502 }
        );
      }

      if (error.message.includes('not configured')) {
        return NextResponse.json(
          {
            error: 'Service not configured',
            message: 'The TikTok integration service is not properly configured.',
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to upload song',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
