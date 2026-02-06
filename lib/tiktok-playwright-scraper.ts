// Server-only import - Playwright should never run on client
import 'server-only';
import { chromium, type Browser, type Page } from 'playwright';

interface TikTokMusicData {
  id: string;
  title: string;
  authorName: string;
  coverUrl: string;
  videoCount?: number;
  duration?: number;
}

export class TikTokPlaywrightScraper {
  private browser: Browser | null = null;

  /**
   * Initialize browser instance (reusable for multiple scrapes)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('Launching Playwright browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Extract music data from TikTok music page using Playwright
   */
  async scrapeMusicPage(url: string): Promise<TikTokMusicData> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    const page = await context.newPage();

    try {
      console.log('Navigating to:', url);
      
      // Navigate to page with timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(3000);

      console.log('Page loaded, extracting data...');

      // Extract data from the page using CORRECT TikTok selectors
      const data = await page.evaluate(() => {
        // Get title from h1[data-e2e="music-title"]
        const titleEl = document.querySelector('h1[data-e2e="music-title"]');
        const title = titleEl?.textContent?.trim() || null;

        // Get artist from h2[data-e2e="music-creator"]
        const artistEl = document.querySelector('h2[data-e2e="music-creator"]');
        const artist = artistEl?.textContent?.trim() || null;

        // Get video count from h2[data-e2e="music-video-count"]
        const countEl = document.querySelector('h2[data-e2e="music-video-count"]');
        const countText = countEl?.textContent?.trim() || null;
        let videoCount: number | null = null;
        
        if (countText) {
          // Extract number from text like "317K videolar" or "1.2M videos" or "1234 videos"
          const match = countText.match(/([\d,.]+)\s*([KMB]?)/i);
          if (match) {
            let num = parseFloat(match[1].replace(',', '.'));
            const multiplier = match[2]?.toUpperCase();
            if (multiplier === 'K') num *= 1000;
            if (multiplier === 'M') num *= 1000000;
            if (multiplier === 'B') num *= 1000000000;
            videoCount = Math.floor(num);
          }
        }

        // Try to find cover image - TikTok shows video thumbnails, use first video thumbnail
        // or look for music artwork in various places
        let coverUrl: string | null = null;
        
        // Method 1: Try to find music artwork/cover
        const musicCoverSelectors = [
          'img[class*="MusicCover"]',
          'img[class*="music-cover"]',
          '[class*="music-info"] img',
          '[class*="MusicInfo"] img',
        ];
        
        for (const selector of musicCoverSelectors) {
          const img = document.querySelector(selector) as HTMLImageElement;
          if (img?.src && img.src.includes('tiktokcdn')) {
            coverUrl = img.src;
            break;
          }
        }
        
        // Method 2: If no dedicated cover, use first video thumbnail (common for music pages)
        if (!coverUrl) {
          const firstVideoThumb = document.querySelector('img[alt*="Taca Nela"], img[src*="tiktokcdn"]') as HTMLImageElement;
          if (firstVideoThumb?.src) {
            coverUrl = firstVideoThumb.src;
          }
        }
        
        // Method 3: Fallback to og:image
        if (!coverUrl) {
          const ogImage = document.querySelector('meta[property="og:image"]');
          coverUrl = ogImage?.getAttribute('content') || null;
        }

        return {
          title,
          artist,
          coverUrl,
          videoCount,
          pageTitle: document.title,
        };
      });

      console.log('Extracted data:', data);

      // Validate that we got at least some data
      if (!data.title && !data.artist && !data.coverUrl) {
        throw new Error('No data could be extracted from the page. Page might be blocked or structure changed.');
      }

      // Extract song ID from URL
      const idMatch = url.match(/\/music\/[^\/]+-(\d+)/);
      const songId = idMatch ? idMatch[1] : '';

      // Build result
      const result: TikTokMusicData = {
        id: songId,
        title: data.title || this.extractTitleFromUrl(url),
        authorName: data.artist || 'Unknown Artist',
        coverUrl: data.coverUrl || '',
        videoCount: data.videoCount,
      };

      console.log('Final result:', result);

      await context.close();
      return result;

    } catch (error: any) {
      console.error('Playwright scraping error:', error);
      await context.close();
      throw new Error(`Failed to scrape TikTok music page: ${error.message}`);
    }
  }

  /**
   * Fallback: Extract title from URL slug
   */
  private extractTitleFromUrl(url: string): string {
    const match = url.match(/\/music\/([^\/\?]+)/);
    if (match) {
      const slug = match[1];
      // Remove song ID and convert dashes to spaces
      return slug
        .replace(/-\d+$/, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return 'Unknown Song';
  }
}

// Export singleton instance
export const playwrightScraper = new TikTokPlaywrightScraper();

// Cleanup on process exit
process.on('beforeExit', async () => {
  await playwrightScraper.close();
});
