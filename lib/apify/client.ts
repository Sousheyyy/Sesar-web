/**
 * Apify client using REST API via fetch() — compatible with Cloudflare Workers.
 * Replaces the Node.js-only `apify-client` SDK.
 */

const APIFY_BASE_URL = 'https://api.apify.com/v2';

interface MusicMetadata {
  title: string;
  authorName: string;
  coverImage: string;
  tiktokMusicId: string;
}

export interface VideoData {
  videoId: string;
  authorUniqueId: string;       // @username (for owner match)
  authorNickname: string;       // display name
  coverImage: string;
  duration: number;             // seconds
  createTime: number;           // unix timestamp
  isPrivate: boolean;
  stats: {
    playCount: number;
    diggCount: number;          // likes
    shareCount: number;
    commentCount: number;
  };
  music: {
    title: string;
    id: string;                 // music ID for song match
    authorName: string;
  };
}

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

export class ApifyClient {
  private getToken(): string {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error('APIFY_API_TOKEN is not configured');
    return token;
  }

  private getMusicActorId(): string {
    return process.env.APIFY_TIKTOK_SOUND_SCRAPER_ACTOR_ID!;
  }

  private getVideoActorId(): string {
    // Same scraptik/tiktok-api actor handles both music and video requests
    return process.env.APIFY_TIKTOK_SOUND_SCRAPER_ACTOR_ID!;
  }

  private getTimeout(): number {
    return parseInt(process.env.APIFY_TIMEOUT_MS || '30000');
  }

  async fetchMusicMetadata(
    tiktokUrl: string,
    retries = 3
  ): Promise<MusicMetadata> {
    try {
      // 1. Extract music ID from URL
      const musicId = this.extractMusicId(tiktokUrl);
      if (!musicId) {
        throw new Error('Could not extract music ID from URL');
      }

      const token = this.getToken();
      const actorId = this.getMusicActorId();
      const timeoutSecs = Math.floor(this.getTimeout() / 1000);

      // 2. Start actor run and wait for it to finish
      const runRes = await fetch(
        `${APIFY_BASE_URL}/acts/${actorId}/runs?waitForFinish=${timeoutSecs}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ music_id: musicId }),
        }
      );

      if (!runRes.ok) {
        const body = await runRes.text();
        throw new Error(`Apify API error ${runRes.status}: ${body.substring(0, 200)}`);
      }

      const run: ApifyRunResponse = await runRes.json();

      // 3. Check if run succeeded
      if (run.data.status !== 'SUCCEEDED') {
        throw new Error(`Apify run failed with status: ${run.data.status}`);
      }

      // 4. Fetch results from the dataset (with timeout)
      const datasetController = new AbortController();
      const datasetTimeout = setTimeout(() => datasetController.abort(), this.getTimeout());

      let datasetRes: Response;
      try {
        datasetRes = await fetch(
          `${APIFY_BASE_URL}/datasets/${run.data.defaultDatasetId}/items?format=json`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: datasetController.signal,
          }
        );
      } finally {
        clearTimeout(datasetTimeout);
      }

      if (!datasetRes.ok) {
        throw new Error(`Failed to fetch Apify dataset: ${datasetRes.status}`);
      }

      const items: any[] = await datasetRes.json();

      // 5. Validate response
      if (!items || items.length === 0) {
        throw new Error('No music data found for this TikTok link');
      }

      const rawData = items[0];
      const music = rawData.music_info || rawData;

      // 6. Validate required fields
      if (!music.title || !music.author || !music.id_str) {
        console.error('Missing required fields:', {
          hasTitle: !!music.title,
          hasAuthor: !!music.author,
          hasIdStr: !!music.id_str,
          receivedFields: Object.keys(music)
        });
        throw new Error('Incomplete music data received from TikTok');
      }

      // 7. Return normalized data
      const coverImageUrl = music.cover_medium?.url_list?.[0]
        || music.cover_large?.url_list?.[0]
        || music.cover_thumb?.url_list?.[0]
        || '';

      console.log('Apify metadata extracted:', {
        title: music.title,
        author: music.author,
        musicId: music.id_str,
      });

      return {
        title: music.title.trim(),
        authorName: music.author.trim(),
        coverImage: coverImageUrl,
        tiktokMusicId: music.id_str
      };

    } catch (error: any) {
      // Retry logic for transient errors
      if (retries > 0 && this.isRetryableError(error)) {
        console.log(`Retrying Apify call... (${retries} attempts left)`);
        await this.sleep(1000 * (4 - retries));
        return this.fetchMusicMetadata(tiktokUrl, retries - 1);
      }

      console.error('Apify fetch failed:', {
        url: tiktokUrl,
        error: error.message,
        retries
      });

      throw new ApifyError(this.getUserFriendlyMessage(error), error);
    }
  }

  /**
   * Extracts the awemeId (video ID) from a TikTok video URL.
   * Supports formats:
   *   - https://www.tiktok.com/@username/video/6811123699203329285
   *   - https://www.tiktok.com/@username/video/6811123699203329285?...
   *   - https://vm.tiktok.com/ZMxxxxxx/ (short links must be resolved first)
   */
  private extractAwemeId(url: string): string | null {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetches video details from a TikTok video URL via the scraptik/tiktok-api actor.
   * Used for video validation (owner match, song match, public status) and metric collection.
   */
  async fetchVideoData(
    videoUrl: string,
    retries = 3
  ): Promise<{ video: VideoData; apifyRunId: string }> {
    try {
      const token = this.getToken();
      const actorId = this.getVideoActorId();
      const timeoutSecs = Math.floor(this.getTimeout() / 1000);

      // Extract awemeId from the TikTok URL
      const awemeId = this.extractAwemeId(videoUrl);
      if (!awemeId) {
        throw new Error('Could not extract video ID from TikTok URL. Make sure the URL contains /video/{id}');
      }

      // Start actor run with post_awemeId
      const runRes = await fetch(
        `${APIFY_BASE_URL}/acts/${actorId}/runs?waitForFinish=${timeoutSecs}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_awemeId: awemeId,
          }),
        }
      );

      if (!runRes.ok) {
        const body = await runRes.text();
        throw new Error(`Apify API error ${runRes.status}: ${body.substring(0, 200)}`);
      }

      const run: ApifyRunResponse = await runRes.json();
      const apifyRunId = run.data.id;

      if (run.data.status !== 'SUCCEEDED') {
        throw new Error(`Apify run failed with status: ${run.data.status}`);
      }

      // Fetch results from dataset (with timeout)
      const vidDatasetController = new AbortController();
      const vidDatasetTimeout = setTimeout(() => vidDatasetController.abort(), this.getTimeout());

      let datasetRes: Response;
      try {
        datasetRes = await fetch(
          `${APIFY_BASE_URL}/datasets/${run.data.defaultDatasetId}/items?format=json`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: vidDatasetController.signal,
          }
        );
      } finally {
        clearTimeout(vidDatasetTimeout);
      }

      if (!datasetRes.ok) {
        throw new Error(`Failed to fetch Apify dataset: ${datasetRes.status}`);
      }

      const items: any[] = await datasetRes.json();

      if (!items || items.length === 0) {
        throw new Error('No video data found for this TikTok URL');
      }

      // The actor may return the data directly or nested under aweme_detail
      const rawItem = items[0];
      const raw = rawItem.aweme_detail || rawItem;

      console.log('Apify raw response keys:', Object.keys(raw));
      console.log('Apify raw author:', JSON.stringify(raw.author, null, 2)?.substring(0, 300));
      console.log('Apify raw stats/statistics:', JSON.stringify(raw.stats || raw.statistics, null, 2)?.substring(0, 300));
      console.log('Apify raw music:', JSON.stringify(raw.music, null, 2)?.substring(0, 300));

      // Normalize the response — scraptik/tiktok-api returns TikTok's internal format (snake_case)
      const video: VideoData = {
        videoId: String(raw.aweme_id || raw.id || raw.video_id || ''),
        authorUniqueId: raw.author?.unique_id || raw.author?.uniqueId || '',
        authorNickname: raw.author?.nickname || '',
        coverImage: raw.video?.cover?.url_list?.[0] || raw.video?.origin_cover?.url_list?.[0] || '',
        duration: raw.video?.duration || raw.duration || 0,
        createTime: raw.create_time || raw.createTime || 0,
        isPrivate: raw.is_private ?? raw.isPrivate ?? false,
        stats: {
          playCount: raw.statistics?.play_count ?? raw.stats?.playCount ?? 0,
          diggCount: raw.statistics?.digg_count ?? raw.stats?.diggCount ?? 0,
          shareCount: raw.statistics?.share_count ?? raw.stats?.shareCount ?? 0,
          commentCount: raw.statistics?.comment_count ?? raw.stats?.commentCount ?? 0,
        },
        music: {
          title: raw.music?.title || '',
          id: raw.music?.id ? String(raw.music.id) : (raw.music?.id_str || ''),
          authorName: raw.music?.author || raw.music?.authorName || '',
        },
      };

      // Validate essential fields
      if (!video.videoId) {
        throw new Error('Could not extract video ID from Apify response');
      }
      if (!video.authorUniqueId) {
        throw new Error('Could not extract author username from Apify response');
      }

      console.log('Apify video data extracted:', {
        videoId: video.videoId,
        author: video.authorUniqueId,
        musicTitle: video.music.title,
        views: video.stats.playCount,
      });

      return { video, apifyRunId };

    } catch (error: any) {
      if (retries > 0 && this.isRetryableError(error)) {
        console.log(`Retrying Apify video fetch... (${retries} attempts left)`);
        await this.sleep(1000 * (4 - retries));
        return this.fetchVideoData(videoUrl, retries - 1);
      }

      console.error('Apify video fetch failed:', {
        url: videoUrl,
        error: error.message,
        retries,
      });

      throw new ApifyError(this.getVideoUserFriendlyMessage(error), error);
    }
  }

  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('rate limit') ||
      error.statusCode === 429 ||
      error.statusCode >= 500
    );
  }

  private getUserFriendlyMessage(error: any): string {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('timeout')) {
      return 'TikTok yanıt vermiyor. Lütfen tekrar deneyin.';
    }
    if (message.includes('no music data')) {
      return 'Bu link için müzik bilgisi bulunamadı. Link\'i kontrol edin.';
    }
    if (message.includes('incomplete music data')) {
      return 'Müzik bilgileri eksik. Farklı bir link deneyin.';
    }
    if (error.statusCode === 429) {
      return 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyin.';
    }

    return 'Müzik bilgileri alınamadı. Lütfen linki kontrol edip tekrar deneyin.';
  }

  private getVideoUserFriendlyMessage(error: any): string {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('timeout')) {
      return 'Video bilgileri alınamadı. TikTok yanıt vermiyor, lütfen tekrar deneyin.';
    }
    if (message.includes('no video data')) {
      return 'Video bulunamadı. Linki kontrol edin.';
    }
    if (message.includes('video id')) {
      return 'Video bilgileri okunamadı. Farklı bir link deneyin.';
    }
    if (message.includes('author username')) {
      return 'Video sahibi bilgisi alınamadı. Videonun herkese açık olduğundan emin olun.';
    }
    if (error.statusCode === 429) {
      return 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyin.';
    }

    return 'Video bilgileri alınamadı. Lütfen linki kontrol edip tekrar deneyin.';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractMusicId(url: string): string | null {
    const musicIdRegex = /\/music\/[^/]*-(\d{19})/;
    const match = url.match(musicIdRegex);
    return match ? match[1] : null;
  }
}

// Custom error class
export class ApifyError extends Error {
  constructor(
    message: string,
    public originalError: Error
  ) {
    super(message);
    this.name = 'ApifyError';
  }
}

// Lazy singleton — only created on first use, not at module import time
let _instance: ApifyClient | null = null;
export const apifyClient = new Proxy({} as ApifyClient, {
  get(_, prop) {
    if (!_instance) _instance = new ApifyClient();
    return (_instance as any)[prop];
  },
});
