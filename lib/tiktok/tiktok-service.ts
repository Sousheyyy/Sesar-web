/**
 * Unified TikTok data service.
 * Primary: RapidAPI tiktok-api23 (cheap, fast)
 * Fallback: Apify scraptik/tiktok-api (expensive, reliable)
 *
 * Every API call is logged to ApiCallLog for monitoring.
 */

import { prisma } from '@/lib/prisma';
import { rapidApiClient, RapidApiError } from './rapidapi-client';
import { apifyClient, ApifyError, type VideoData } from '@/lib/apify/client';

export type { VideoData } from '@/lib/apify/client';

export type ApiProvider = 'RAPIDAPI' | 'APIFY';

interface MusicMetadata {
  title: string;
  authorName: string;
  coverImage: string;
  tiktokMusicId: string;
}

interface FetchResult<T> {
  data: T;
  provider: ApiProvider;
  isFallback: boolean;
  durationMs: number;
}

/**
 * Log an API call to the database for monitoring.
 * Fire-and-forget — never blocks the caller.
 */
function logApiCall(params: {
  provider: ApiProvider;
  endpoint: string;
  method: string;
  statusCode?: number;
  success: boolean;
  duration?: number;
  errorMessage?: string;
  context?: string;
  campaignId?: string;
  userId?: string;
  isFallback?: boolean;
}): void {
  prisma.apiCallLog
    .create({
      data: {
        provider: params.provider,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode ?? null,
        success: params.success,
        duration: params.duration ?? null,
        errorMessage: params.errorMessage ?? null,
        context: params.context ?? null,
        campaignId: params.campaignId ?? null,
        userId: params.userId ?? null,
        isFallback: params.isFallback ?? false,
      },
    })
    .catch((err) => {
      console.error('[TikTokService] Failed to log API call:', err.message);
    });
}

/**
 * Extract video ID (awemeId) from a TikTok URL.
 * Supports: /video/{id}, /@user/video/{id}
 */
function extractVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract music ID from a TikTok URL.
 * Supports: /music/{slug}-{19-digit-id}
 */
function extractMusicId(url: string): string | null {
  const match = url.match(/\/music\/[^/]*-(\d{19})/);
  return match ? match[1] : null;
}

export class TikTokService {
  /**
   * Fetch video data with RapidAPI primary, Apify fallback.
   *
   * @param videoUrl   TikTok video URL (e.g. https://www.tiktok.com/@user/video/123)
   * @param context    Caller context for logging (e.g. "router:submitVideo", "cron:per-campaign-metrics")
   * @param campaignId Optional campaign ID for logging
   * @param userId     Optional user ID for logging
   */
  async fetchVideoData(
    videoUrl: string,
    context?: string,
    campaignId?: string,
    userId?: string
  ): Promise<FetchResult<VideoData>> {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Could not extract video ID from TikTok URL. URL must contain /video/{id}');
    }

    // ── Try RapidAPI first ──
    const rapidStart = Date.now();
    try {
      const { video, durationMs } = await rapidApiClient.fetchVideoData(videoId);

      logApiCall({
        provider: 'RAPIDAPI',
        endpoint: '/api/post/detail',
        method: 'GET',
        statusCode: 200,
        success: true,
        duration: durationMs,
        context,
        campaignId,
        userId,
      });

      return { data: video, provider: 'RAPIDAPI', isFallback: false, durationMs };
    } catch (rapidErr: any) {
      const rapidDuration = Date.now() - rapidStart;
      console.warn(
        `[TikTokService] RapidAPI video fetch failed for ${videoId}: ${rapidErr.message}. Falling back to Apify.`
      );

      logApiCall({
        provider: 'RAPIDAPI',
        endpoint: '/api/post/detail',
        method: 'GET',
        statusCode: rapidErr instanceof RapidApiError ? rapidErr.statusCode : undefined,
        success: false,
        duration: rapidDuration,
        errorMessage: rapidErr.message,
        context,
        campaignId,
        userId,
      });
    }

    // ── Fallback to Apify ──
    const apifyStart = Date.now();
    try {
      const { video, apifyRunId } = await apifyClient.fetchVideoData(videoUrl);
      const durationMs = Date.now() - apifyStart;

      logApiCall({
        provider: 'APIFY',
        endpoint: 'fetchVideoData',
        method: 'POST',
        statusCode: 200,
        success: true,
        duration: durationMs,
        context,
        campaignId,
        userId,
        isFallback: true,
      });

      return { data: video, provider: 'APIFY', isFallback: true, durationMs };
    } catch (apifyErr: any) {
      const durationMs = Date.now() - apifyStart;

      logApiCall({
        provider: 'APIFY',
        endpoint: 'fetchVideoData',
        method: 'POST',
        success: false,
        duration: durationMs,
        errorMessage: apifyErr.message,
        context,
        campaignId,
        userId,
        isFallback: true,
      });

      // Both providers failed — throw the Apify error (usually has better user-friendly messages)
      throw apifyErr;
    }
  }

  /**
   * Fetch music metadata with RapidAPI primary, Apify fallback.
   *
   * @param tiktokUrl  TikTok music URL (e.g. https://www.tiktok.com/music/song-name-123456789)
   * @param context    Caller context for logging
   * @param userId     Optional user ID for logging
   */
  async fetchMusicMetadata(
    tiktokUrl: string,
    context?: string,
    userId?: string
  ): Promise<FetchResult<MusicMetadata>> {
    const musicId = extractMusicId(tiktokUrl);
    if (!musicId) {
      throw new Error('Could not extract music ID from URL');
    }

    // ── Try RapidAPI first ──
    const rapidMusicStart = Date.now();
    try {
      const { data, durationMs } = await rapidApiClient.fetchMusicMetadata(musicId);

      logApiCall({
        provider: 'RAPIDAPI',
        endpoint: '/api/music/info',
        method: 'GET',
        statusCode: 200,
        success: true,
        duration: durationMs,
        context,
        userId,
      });

      return { data, provider: 'RAPIDAPI', isFallback: false, durationMs };
    } catch (rapidErr: any) {
      const rapidMusicDuration = Date.now() - rapidMusicStart;
      console.warn(
        `[TikTokService] RapidAPI music fetch failed for ${musicId}: ${rapidErr.message}. Falling back to Apify.`
      );

      logApiCall({
        provider: 'RAPIDAPI',
        endpoint: '/api/music/info',
        method: 'GET',
        statusCode: rapidErr instanceof RapidApiError ? rapidErr.statusCode : undefined,
        success: false,
        duration: rapidMusicDuration,
        errorMessage: rapidErr.message,
        context,
        userId,
      });
    }

    // ── Fallback to Apify ──
    const apifyStart = Date.now();
    try {
      const data = await apifyClient.fetchMusicMetadata(tiktokUrl);
      const durationMs = Date.now() - apifyStart;

      logApiCall({
        provider: 'APIFY',
        endpoint: 'fetchMusicMetadata',
        method: 'POST',
        statusCode: 200,
        success: true,
        duration: durationMs,
        context,
        userId,
        isFallback: true,
      });

      return { data, provider: 'APIFY', isFallback: true, durationMs };
    } catch (apifyErr: any) {
      const durationMs = Date.now() - apifyStart;

      logApiCall({
        provider: 'APIFY',
        endpoint: 'fetchMusicMetadata',
        method: 'POST',
        success: false,
        duration: durationMs,
        errorMessage: apifyErr.message,
        context,
        userId,
        isFallback: true,
      });

      throw apifyErr;
    }
  }
}

// Lazy singleton
let _instance: TikTokService | null = null;
export const tiktokService = new Proxy({} as TikTokService, {
  get(_, prop) {
    if (!_instance) _instance = new TikTokService();
    return (_instance as any)[prop];
  },
});
