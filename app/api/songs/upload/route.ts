/**
 * Song Upload with Apify Integration
 * POST /api/songs/upload
 *
 * Supports TikTok MUSIC URLs and VIDEO URLs.
 * Uses Apify to fetch music metadata (song name, artist name, cover art).
 * Database-level caching prevents duplicate API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apifyClient, ApifyError } from '@/lib/apify/client';
import { TikTokUrlParser, ValidationError } from '@/lib/apify/url-utils';
import { rateLimit } from '@/lib/rate-limit';
import { uploadImageFromUrl, STORAGE_BUCKETS } from '@/lib/supabase/storage';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authentication check
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const { tiktokUrl } = await req.json();

    if (!tiktokUrl) {
      return NextResponse.json(
        { error: 'TikTok linki gereklidir' },
        { status: 400 }
      );
    }

    // 3. Rate limiting (10 requests per hour per user)
    const identifier = session.user.id;
    const rateLimitResult = await rateLimit(identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Çok fazla istek gönderildi. Lütfen 1 saat sonra tekrar deneyin.',
          retryAfter: rateLimitResult.reset
        },
        { status: 429 }
      );
    }

    // 4. Validate and normalize URL (handles redirects)
    let normalizedUrl: string;
    try {
      normalizedUrl = await TikTokUrlParser.validateAndNormalize(tiktokUrl);
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      throw error;
    }

    // 5. Try to extract music ID for DB lookup
    const musicId = TikTokUrlParser.extractMusicId(normalizedUrl);

    // 6. Database-level caching: Check if we already have this song
    if (musicId) {
      const existingSong = await prisma.song.findUnique({
        where: { tiktokMusicId: musicId }
      });

      if (existingSong) {
        // Migrate cover to Supabase if it's still a TikTok CDN URL
        if (existingSong.coverImage && !existingSong.coverImage.includes('supabase')) {
          const storagePath = `${existingSong.tiktokMusicId || existingSong.id}/${Date.now()}.jpg`;
          const permanentUrl = await uploadImageFromUrl(STORAGE_BUCKETS.COVERS, storagePath, existingSong.coverImage);
          if (permanentUrl) {
            const updatedSong = await prisma.song.update({
              where: { id: existingSong.id },
              data: { coverImage: permanentUrl }
            });
            if (updatedSong.artistId === session.user.id) {
              return NextResponse.json({
                success: true,
                song: updatedSong,
                cached: true,
                message: 'Müzik zaten kütüphanenizde mevcut',
                existing: true
              });
            }
          }
        }

        // Return existing song if it belongs to this user
        if (existingSong.artistId === session.user.id) {
          return NextResponse.json({
            success: true,
            song: existingSong,
            cached: true,
            message: 'Müzik zaten kütüphanenizde mevcut',
            existing: true
          });
        }

        // Song exists but belongs to another user
        return NextResponse.json(
          {
            error: 'Bu müzik başka bir sanatçı tarafından eklenmiş',
            message: 'Bu müzik zaten sistemde mevcut',
            song: {
              id: existingSong.id,
              title: existingSong.title,
              authorName: existingSong.authorName,
            },
          },
          { status: 409 }
        );
      }
    }

    // 7. Fetch from Apify (first time or no music ID extracted)

    let metadata: { title: string; authorName: string; coverImage: string; tiktokMusicId: string };
    try {
      metadata = await apifyClient.fetchMusicMetadata(normalizedUrl);
    } catch (error) {
      if (error instanceof ApifyError) {
        return NextResponse.json(
          { error: error.message },
          { status: 503 } // Service unavailable
        );
      }
      throw error;
    }

    // 8. Upload cover image to Supabase Storage (TikTok CDN URLs don't work on mobile)
    let coverImageUrl = metadata.coverImage;
    if (coverImageUrl) {
      const storagePath = `${metadata.tiktokMusicId}/${Date.now()}.jpg`;
      const permanentUrl = await uploadImageFromUrl(STORAGE_BUCKETS.COVERS, storagePath, coverImageUrl);
      if (permanentUrl) {
        coverImageUrl = permanentUrl;
      } else {
        console.warn('Cover upload to Supabase failed, keeping original URL');
      }
    }

    // 9. Save to database (upsert to handle race conditions)
    const song = await prisma.song.upsert({
      where: { tiktokMusicId: metadata.tiktokMusicId },
      update: {
        // Update URL and timestamp in case of race condition
        tiktokUrl: normalizedUrl,
        updatedAt: new Date(),
        statsLastFetched: new Date()
      },
      create: {
        title: metadata.title,
        authorName: metadata.authorName,
        coverImage: coverImageUrl,
        tiktokUrl: normalizedUrl,
        tiktokMusicId: metadata.tiktokMusicId,
        musicCoverUrl: metadata.coverImage,
        musicUrl: normalizedUrl,
        statsLastFetched: new Date(),
        artist: {
          connect: { id: session.user.id }
        }
      }
    });

    return NextResponse.json({
      success: true,
      song,
      cached: false,
      message: `"${metadata.title}" başarıyla eklendi`
    });

  } catch (error: any) {
    // Log error for monitoring
    console.error('Song upload failed:', {
      error: error.message,
      type: error.name,
      duration: Date.now() - startTime
    });

    // Handle specific error types
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof ApifyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 } // Service unavailable
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'Bir hata oluştu. Lütfen tekrar deneyin.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
