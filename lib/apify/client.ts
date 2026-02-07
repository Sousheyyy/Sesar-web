import { ApifyClient as ApifySDK } from 'apify-client';

interface MusicMetadata {
  title: string;
  authorName: string;
  coverImage: string;
  tiktokMusicId: string;
}

export class ApifyClient {
  private client: ApifySDK;
  private actorId: string;
  private timeout: number;

  constructor() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error('APIFY_API_TOKEN is not configured');

    this.client = new ApifySDK({ token });
    this.actorId = process.env.APIFY_TIKTOK_SOUND_SCRAPER_ACTOR_ID!;
    this.timeout = parseInt(process.env.APIFY_TIMEOUT_MS || '30000');
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

      // 2. Run the actor and wait for it to finish (call() does both automatically)
      const run = await this.client.actor(this.actorId).call({
        music_id: musicId  // Send just the ID, not the full URL
      });

      // 2. Check if run succeeded
      if (run.status !== 'SUCCEEDED') {
        throw new Error(`Apify run failed with status: ${run.status}`);
      }

      // 3. Fetch the results from the dataset
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      // 4. Validate response
      if (!items || items.length === 0) {
        throw new Error('No music data found for this TikTok link');
      }

      const rawData = items[0] as any;

      // The actor returns data nested under music_info
      const music = rawData.music_info || rawData;

      // 5. Validate required fields (actor uses 'author' and 'id_str', not 'authorName' and 'musicId')
      if (!music.title || !music.author || !music.id_str) {
        console.error('Missing required fields:', {
          hasTitle: !!music.title,
          hasAuthor: !!music.author,
          hasIdStr: !!music.id_str,
          receivedFields: Object.keys(music)
        });
        throw new Error('Incomplete music data received from TikTok');
      }

      // 6. Return normalized data
      const coverImageUrl = music.cover_medium?.url_list?.[0] || music.cover_large?.url_list?.[0] || music.cover_thumb?.url_list?.[0] || '';

      console.log('✅ Apify metadata extracted:', {
        title: music.title,
        author: music.author,
        coverImageUrl,
        musicId: music.id_str,
        coverMediumExists: !!music.cover_medium,
        urlListLength: music.cover_medium?.url_list?.length || 0
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
        await this.sleep(1000 * (4 - retries)); // exponential backoff
        return this.fetchMusicMetadata(tiktokUrl, retries - 1);
      }

      // Log and rethrow
      console.error('Apify fetch failed:', {
        url: tiktokUrl,
        error: error.message,
        retries
      });

      throw new ApifyError(this.getUserFriendlyMessage(error), error);
    }
  }

  private isRetryableError(error: any): boolean {
    // Retry on network issues, timeouts, and rate limits
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

  /**
   * Extracts the 19-digit music ID from a TikTok URL
   * Example: https://www.tiktok.com/music/Uff-Mi-Amor-7179385964928698369 -> 7179385964928698369
   */
  private extractMusicId(url: string): string | null {
    const musicIdRegex = /\/music\/[^/]*-(\d{19})/;
    const match = url.match(musicIdRegex);
    return match ? match[1] : null;
  }
}

// Custom error class for better error handling
export class ApifyError extends Error {
  constructor(
    message: string,
    public originalError: Error
  ) {
    super(message);
    this.name = 'ApifyError';
  }
}

// Singleton instance
export const apifyClient = new ApifyClient();
