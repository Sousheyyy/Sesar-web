/**
 * RapidAPI TikTok API23 client.
 * Endpoints:
 *   - GET /api/post/detail?videoId={id}   → Video info
 *   - GET /api/music/info?musicId={id}     → Music/sound info
 *
 * Docs: https://docs.tikfly.io/api-reference/post/get-post-detail
 */

import type { VideoData } from '@/lib/apify/client';

const RAPIDAPI_BASE_URL = 'https://tiktok-api23.p.rapidapi.com';

interface RapidApiMusicResponse {
  data: {
    musicInfo: {
      music: {
        id: string;
        title: string;
        authorName: string;
        coverLarge: string;
        coverMedium: string;
        coverThumb: string;
        duration: number;
        playUrl: string;
        album: string;
      };
      stats: {
        videoCount: number;
      };
      artist: {
        uniqueId: string;
        nickname: string;
      };
    };
    statusCode: number;
    status_code: number;
  };
}

interface RapidApiVideoResponse {
  itemInfo: {
    itemStruct: {
      id: string;
      desc: string;
      createTime: string;
      author: {
        uniqueId: string;
        nickname: string;
        verified: boolean;
      };
      music: {
        id: string;
        title: string;
        authorName: string;
        duration: number;
        coverLarge: string;
      };
      stats: {
        playCount: number;
        diggCount: number;
        commentCount: number;
        shareCount: number;
        collectCount: string;
      };
      video: {
        duration: number;
        cover: string;
      };
      privateItem: boolean;
    };
  };
  statusCode: number;
  statusMsg: string;
}

export interface MusicMetadata {
  title: string;
  authorName: string;
  coverImage: string;
  tiktokMusicId: string;
}

export class RapidApiClient {
  private getApiKey(): string {
    const key = process.env.RAPIDAPI_KEY;
    if (!key) throw new Error('RAPIDAPI_KEY is not configured');
    return key;
  }

  private getHost(): string {
    return process.env.RAPIDAPI_HOST || 'tiktok-api23.p.rapidapi.com';
  }

  private getTimeout(): number {
    return parseInt(process.env.RAPIDAPI_TIMEOUT_MS || '15000');
  }

  /**
   * Fetch music/sound metadata by music ID.
   * Endpoint: GET /api/music/info?musicId={id}
   */
  async fetchMusicMetadata(musicId: string): Promise<{ data: MusicMetadata; durationMs: number }> {
    const start = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.getTimeout());

    try {
      const res = await fetch(
        `${RAPIDAPI_BASE_URL}/api/music/info?musicId=${encodeURIComponent(musicId)}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': this.getHost(),
            'x-rapidapi-key': this.getApiKey(),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const durationMs = Date.now() - start;

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new RapidApiError(
          `RapidAPI music fetch failed (${res.status}): ${body.substring(0, 200)}`,
          res.status
        );
      }

      const json: RapidApiMusicResponse = await res.json();

      // Check TikTok-level status
      if (json.data?.statusCode !== 0 && json.data?.status_code !== 0) {
        throw new RapidApiError(
          `TikTok returned error status for music ${musicId}`,
          200
        );
      }

      const music = json.data?.musicInfo?.music;
      if (!music?.title || !music?.id) {
        throw new RapidApiError('Incomplete music data from RapidAPI', 200);
      }

      return {
        data: {
          title: music.title.trim(),
          authorName: (music.authorName || '').trim(),
          coverImage: music.coverLarge || music.coverMedium || music.coverThumb || '',
          tiktokMusicId: String(music.id),
        },
        durationMs,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - start;

      if (error instanceof RapidApiError) throw error;
      if (error.name === 'AbortError') {
        throw new RapidApiError('RapidAPI music fetch timed out', 0);
      }
      throw new RapidApiError(`RapidAPI music fetch error: ${error.message}`, 0);
    }
  }

  /**
   * Fetch video/post details by video ID.
   * Endpoint: GET /api/post/detail?videoId={id}
   */
  async fetchVideoData(videoId: string): Promise<{ video: VideoData; durationMs: number }> {
    const start = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.getTimeout());

    try {
      const res = await fetch(
        `${RAPIDAPI_BASE_URL}/api/post/detail?videoId=${encodeURIComponent(videoId)}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-host': this.getHost(),
            'x-rapidapi-key': this.getApiKey(),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const durationMs = Date.now() - start;

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new RapidApiError(
          `RapidAPI video fetch failed (${res.status}): ${body.substring(0, 200)}`,
          res.status
        );
      }

      const json: RapidApiVideoResponse = await res.json();

      // Check TikTok-level status
      if (json.statusCode !== 0) {
        throw new RapidApiError(
          `TikTok returned error for video ${videoId} (statusCode: ${json.statusCode})`,
          200
        );
      }

      const item = json.itemInfo?.itemStruct;
      if (!item) {
        throw new RapidApiError('No video data in RapidAPI response', 200);
      }

      const video: VideoData = {
        videoId: String(item.id || videoId),
        authorUniqueId: item.author?.uniqueId || '',
        authorNickname: item.author?.nickname || '',
        coverImage: item.video?.cover || '',
        duration: item.video?.duration || 0,
        createTime: parseInt(item.createTime) || 0,
        isPrivate: item.privateItem ?? false,
        stats: {
          playCount: item.stats?.playCount ?? 0,
          diggCount: item.stats?.diggCount ?? 0,
          shareCount: item.stats?.shareCount ?? 0,
          commentCount: item.stats?.commentCount ?? 0,
        },
        music: {
          title: item.music?.title || '',
          id: item.music?.id ? String(item.music.id) : '',
          authorName: item.music?.authorName || '',
        },
      };

      if (!video.videoId) {
        throw new RapidApiError('Could not extract video ID from RapidAPI response', 200);
      }
      if (!video.authorUniqueId) {
        throw new RapidApiError('Could not extract author from RapidAPI response', 200);
      }

      return { video, durationMs };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error instanceof RapidApiError) throw error;
      if (error.name === 'AbortError') {
        throw new RapidApiError('RapidAPI video fetch timed out', 0);
      }
      throw new RapidApiError(`RapidAPI video fetch error: ${error.message}`, 0);
    }
  }
}

export class RapidApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'RapidApiError';
  }
}

// Lazy singleton
let _instance: RapidApiClient | null = null;
export const rapidApiClient = new Proxy({} as RapidApiClient, {
  get(_, prop) {
    if (!_instance) _instance = new RapidApiClient();
    return (_instance as any)[prop];
  },
});
