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

  private getActorId(): string {
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
      const actorId = this.getActorId();
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

      // 4. Fetch results from the dataset
      const datasetRes = await fetch(
        `${APIFY_BASE_URL}/datasets/${run.data.defaultDatasetId}/items?format=json`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

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
