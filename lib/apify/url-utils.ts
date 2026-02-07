export class TikTokUrlParser {
  private static readonly REDIRECT_TIMEOUT = 5000; // 5 seconds
  private static readonly MUSIC_ID_REGEX = /\/music\/[^/]*-(\d{19})/;
  private static readonly SHORT_LINK_DOMAINS = ['vm.tiktok.com', 'vt.tiktok.com'];

  /**
   * Validates and normalizes a TikTok URL
   * Handles: music links, video links, and short links (vm.tiktok.com)
   */
  static async validateAndNormalize(url: string): Promise<string> {
    try {
      // 1. Basic validation
      if (!url || typeof url !== 'string') {
        throw new Error('Geçersiz URL formatı');
      }

      const trimmedUrl = url.trim();

      // 2. Must be a TikTok URL
      if (!trimmedUrl.includes('tiktok.com')) {
        throw new Error('Lütfen geçerli bir TikTok linki girin');
      }

      // 3. Handle short links (vm.tiktok.com, vt.tiktok.com)
      if (this.isShortLink(trimmedUrl)) {
        return await this.resolveShortLink(trimmedUrl);
      }

      // 4. Validate it's a music or video link
      if (!this.isMusicOrVideoLink(trimmedUrl)) {
        throw new Error('Lütfen TikTok müzik veya video linki kullanın');
      }

      return trimmedUrl;

    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Extracts the music ID from a TikTok URL
   */
  static extractMusicId(url: string): string | null {
    const match = url.match(this.MUSIC_ID_REGEX);
    return match ? match[1] : null;
  }

  /**
   * Checks if URL is a short link that needs resolution
   */
  private static isShortLink(url: string): boolean {
    return this.SHORT_LINK_DOMAINS.some(domain => url.includes(domain));
  }

  /**
   * Checks if URL is a music or video link
   */
  private static isMusicOrVideoLink(url: string): boolean {
    return url.includes('/music/') || url.includes('/video/') || url.includes('/@');
  }

  /**
   * Resolves short TikTok links by following redirects
   */
  private static async resolveShortLink(shortUrl: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REDIRECT_TIMEOUT);

    try {
      // Follow redirects to get the final URL
      const response = await fetch(shortUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.url) {
        throw new Error('Kısa link çözümlenemedi');
      }

      // Validate the resolved URL is a TikTok link
      if (!response.url.includes('tiktok.com')) {
        throw new Error('Link geçerli bir TikTok sayfasına yönlendirilmiyor');
      }

      return response.url;

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Link çözümleme zaman aşımına uğradı');
      }

      throw new Error('Kısa link çözümlenemedi. Lütfen tam linki kullanın.');
    }
  }
}

// Custom error class
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
