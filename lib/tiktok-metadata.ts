// Server-only import - this should never run on the client
import 'server-only';
import { playwrightScraper } from './tiktok-playwright-scraper';

interface SongMetadata {
  id: string;
  title: string;
  authorName: string;
  coverUrl?: string;
  duration?: number;
  playUrl?: string;
  videoCount?: number;
}

interface VideoMetadata {
  id: string;
  description: string;
  song: SongMetadata;
  author: string;
  authorNickname: string;
  createTime: number;
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  duration: number;
}

export class TikTokMetadataService {
  /**
   * Normalize TikTok URL to handle mobile, desktop, and short links
   * Supports:
   * - www.tiktok.com (desktop)
   * - m.tiktok.com (mobile web)
   * - vm.tiktok.com (short links - follows redirect)
   * - vt.tiktok.com (alternative short links)
   */
  private async normalizeTikTokUrl(url: string): Promise<string> {
    try {
      // Handle short links by following redirects
      if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
        });
        url = response.url;
      }

      // Convert mobile web to desktop format (scraper works better with desktop)
      url = url.replace('m.tiktok.com', 'www.tiktok.com');

      // Ensure https
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      return url;
    } catch (error) {
      console.warn('URL normalization failed, using original URL:', error);
      return url;
    }
  }
  /**
   * Check if URL is a video URL or music page URL
   */
  private isMusicPageUrl(url: string): boolean {
    return url.includes('/music/') && !url.includes('/video/');
  }

  /**
   * Check if URL is a video URL
   */
  private isVideoUrl(url: string): boolean {
    return url.includes('/video/') || url.includes('/@');
  }

  /**
   * Scrape cover art and additional metadata from TikTok music page
   */
  private async scrapeMusicPageMetadata(url: string): Promise<{
    coverUrl?: string;
    authorName?: string;
    title?: string;
  }> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      
      if (!response.ok) {
        console.warn('Failed to fetch music page for metadata scraping, status:', response.status);
        return {};
      }
      
      const html = await response.text();
      
      // Log a sample of the HTML to help debug
      console.log('HTML sample (first 500 chars):', html.substring(0, 500));
      
      // First, try the simplest approach - Open Graph meta tags (most reliable)
      console.log('Trying Open Graph tags first...');
      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      
      console.log('OG tags found:', {
        image: ogImageMatch?.[1],
        title: ogTitleMatch?.[1],
        description: ogDescMatch?.[1]
      });
      
      // Extract artist from title if available
      let extractedArtist: string | undefined;
      let extractedTitle: string | undefined;
      
      if (ogTitleMatch) {
        const titleText = ogTitleMatch[1];
        // Try patterns like "Title - Artist", "Title · Artist", or "Title | TikTok"
        const dashSplit = titleText.split(' - ');
        const dotSplit = titleText.split(' · ');
        const pipeSplit = titleText.split(' | ');
        
        if (dashSplit.length >= 2 && !dashSplit[1].includes('TikTok')) {
          extractedTitle = dashSplit[0].trim();
          extractedArtist = dashSplit[1].trim();
        } else if (dotSplit.length >= 2) {
          extractedTitle = dotSplit[0].trim();
          extractedArtist = dotSplit[1].trim();
        } else if (pipeSplit.length >= 2 && !pipeSplit[0].includes('TikTok')) {
          extractedTitle = pipeSplit[0].trim();
          // Artist might be in description
        } else {
          extractedTitle = titleText.replace(/\s*\|\s*TikTok.*$/i, '').trim();
        }
      }
      
      // Try to get artist from description
      if (ogDescMatch && !extractedArtist) {
        const desc = ogDescMatch[1];
        // Look for patterns like "Artist Name · Song Name" or "by Artist Name"
        const byMatch = desc.match(/by\s+([^·|]+)/i);
        const dotMatch = desc.match(/([^·]+)\s*·/);
        
        if (byMatch) {
          extractedArtist = byMatch[1].trim();
        } else if (dotMatch) {
          // Sometimes artist is before the dot
          const possibleArtist = dotMatch[1].trim();
          if (!possibleArtist.toLowerCase().includes('tiktok') && possibleArtist.length < 100) {
            extractedArtist = possibleArtist;
          }
        }
      }
      
      // If we have cover and at least title or artist from OG tags, return it
      if (ogImageMatch && (extractedTitle || extractedArtist)) {
        console.log('Successfully extracted from OG tags:', {
          coverUrl: ogImageMatch[1],
          title: extractedTitle,
          authorName: extractedArtist
        });
        return {
          coverUrl: ogImageMatch[1],
          title: extractedTitle,
          authorName: extractedArtist
        };
      }
      
      // TikTok embeds data in __UNIVERSAL_DATA_FOR_REHYDRATION__ or SIGI_STATE
      // Try to extract the initial state data
      const sigiStateMatch = html.match(/<script\s+id="SIGI_STATE"[^>]*>(.*?)<\/script>/i);
      if (sigiStateMatch) {
        try {
          const stateData = JSON.parse(sigiStateMatch[1]);
          console.log('Found SIGI_STATE, keys:', Object.keys(stateData));
          
          // Navigate through the state to find music data
          if (stateData.MusicModule) {
            const musicData = Object.values(stateData.MusicModule)[0] as any;
            if (musicData) {
              return {
                coverUrl: musicData.coverLarge || musicData.coverMedium || musicData.coverThumb,
                authorName: musicData.authorName || musicData.author,
                title: musicData.title
              };
            }
          }
        } catch (e) {
          console.warn('Failed to parse SIGI_STATE:', e);
        }
      }
      
      // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
      const universalDataMatch = html.match(/<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/i);
      if (universalDataMatch) {
        try {
          const universalData = JSON.parse(universalDataMatch[1]);
          console.log('Found UNIVERSAL_DATA, keys:', Object.keys(universalData));
          
          // Music data might be nested differently - try multiple paths
          const defaultScope = universalData?.__DEFAULT_SCOPE__;
          if (defaultScope) {
            console.log('DEFAULT_SCOPE keys:', Object.keys(defaultScope));
            
            // Try webapp.music-detail
            if (defaultScope['webapp.music-detail']) {
              const musicDetail = defaultScope['webapp.music-detail'];
              console.log('musicDetail keys:', Object.keys(musicDetail));
              const musicInfo = musicDetail?.musicInfo;
              if (musicInfo) {
                console.log('Found musicInfo:', { title: musicInfo.title, authorName: musicInfo.authorName });
                return {
                  coverUrl: musicInfo.cover || musicInfo.coverLarge || musicInfo.coverMedium,
                  authorName: musicInfo.authorName || musicInfo.author,
                  title: musicInfo.title
                };
              }
            }
            
            // Try to find music data in any key that contains "music"
            for (const key of Object.keys(defaultScope)) {
              if (key.toLowerCase().includes('music')) {
                console.log('Found music-related key:', key);
                const data = defaultScope[key];
                if (typeof data === 'object' && data !== null) {
                  // Look for music info in common locations
                  const musicInfo = data.musicInfo || data.music || data;
                  if (musicInfo && (musicInfo.title || musicInfo.authorName)) {
                    console.log('Extracted from key', key, ':', { title: musicInfo.title, authorName: musicInfo.authorName });
                    return {
                      coverUrl: musicInfo.cover || musicInfo.coverLarge || musicInfo.coverMedium || musicInfo.coverThumb,
                      authorName: musicInfo.authorName || musicInfo.author,
                      title: musicInfo.title
                    };
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse UNIVERSAL_DATA:', e);
        }
      }
      
      // Last resort fallback: If we at least have an image, return it
      if (ogImageMatch) {
        console.log('Last resort: returning just the cover image from OG tags');
        return {
          coverUrl: ogImageMatch[1],
          title: extractedTitle,
          authorName: extractedArtist
        };
      }
      
      // Fallback: Try Twitter card
      const twitterImageMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
      const twitterTitleMatch = html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i);
      
      if (twitterImageMatch || twitterTitleMatch) {
        console.log('Extracted from Twitter tags:', { 
          coverUrl: twitterImageMatch?.[1], 
          title: twitterTitleMatch?.[1] 
        });
        return {
          coverUrl: twitterImageMatch?.[1],
          title: twitterTitleMatch?.[1]
        };
      }
      
      console.warn('No metadata found in TikTok page');
      return {};
    } catch (error) {
      console.warn('Failed to scrape music page metadata:', error);
      return {};
    }
  }

  /**
   * Extract song metadata from TikTok music/sound URL or video URL
   * Primary method: Playwright scraping (most reliable)
   * Fallback: tiktok-scraper-ts
   */
  async getSongMetadata(url: string): Promise<SongMetadata> {
    // Normalize URL to handle mobile/desktop/short links
    const normalizedUrl = await this.normalizeTikTokUrl(url);
    console.log('Fetching song from URL:', normalizedUrl);
    
    // Check if it's a music page URL or video URL
    if (this.isMusicPageUrl(normalizedUrl)) {
      console.log('Music page detected, using Playwright scraper...');
      
      try {
        // PRIMARY METHOD: Use Playwright for reliable scraping
        const playwrightData = await playwrightScraper.scrapeMusicPage(normalizedUrl);
        
        console.log('✅ Playwright scraping successful:', {
          title: playwrightData.title,
          author: playwrightData.authorName,
          hasCover: !!playwrightData.coverUrl,
          videoCount: playwrightData.videoCount
        });
        
        return {
          id: playwrightData.id,
          title: playwrightData.title,
          authorName: playwrightData.authorName,
          coverUrl: playwrightData.coverUrl,
          videoCount: playwrightData.videoCount,
          duration: playwrightData.duration,
          playUrl: undefined,
        };
      } catch (playwrightError: any) {
        console.warn('⚠️ Playwright scraping failed, trying fallback method:', playwrightError.message);
        
        // FALLBACK: Try old scraping method
        return await this.fallbackScraping(normalizedUrl);
      }
    }
    
    // For video URLs, use tiktok-scraper-ts
    return await this.scrapeFromVideo(normalizedUrl);
  }

  /**
   * Fallback scraping method when Playwright fails
   */
  private async fallbackScraping(normalizedUrl: string): Promise<SongMetadata> {
    const TikTokScraper = await import('tiktok-scraper-ts');
    
    if (this.isMusicPageUrl(normalizedUrl)) {
      // For music page URLs, extract song ID and create metadata
      // TikTok music URL format: /music/Song-Name-123456789
      const musicIdMatch = normalizedUrl.match(/\/music\/[^\/]+-(\d+)/);
      if (!musicIdMatch) {
        throw new Error('Could not extract song ID from music URL');
      }
      
      const songId = musicIdMatch[1];
      const songNameSlug = normalizedUrl.match(/\/music\/([^\/\?]+)/)?.[1] || '';
      // Convert slug to title: "Some-Song-Name" -> "Some Song Name"
      const songTitle = songNameSlug.replace(/-\d+$/, '').split('-').join(' ');
      
      console.log('Music page detected:', { songId, songTitle });
      
      // Scrape additional metadata from the music page (cover art, etc.)
      console.log('Scraping music page for cover art...');
      const scrapedMetadata = await this.scrapeMusicPageMetadata(normalizedUrl);
      
      console.log('Scraped metadata:', scrapedMetadata);
      
      // For music pages, combine URL-extracted data with scraped metadata
      return {
        id: songId,
        title: scrapedMetadata.title || songTitle,
        authorName: scrapedMetadata.authorName || 'Unknown Artist',
        coverUrl: scrapedMetadata.coverUrl,
        duration: undefined, // Will be updated when first video uses it
        playUrl: undefined,
      };
    }
  }

  /**
   * Scrape song data from a video URL
   */
  private async scrapeFromVideo(normalizedUrl: string): Promise<SongMetadata> {
    const TikTokScraper = await import('tiktok-scraper-ts');
    const getMusic = TikTokScraper.getMusic || TikTokScraper.default?.getMusic;
    
    if (!getMusic) {
      throw new Error('getMusic function not found in tiktok-scraper-ts');
    }
    
    try {
      const musicData = await getMusic(normalizedUrl);
      
      console.log('Song data fetched from video:', {
        id: musicData?.id,
        title: musicData?.title,
        authorName: musicData?.authorName
      });
      
      return {
        id: musicData.id,
        title: musicData.title,
        authorName: musicData.authorName,
        coverUrl: musicData.coverUrl,
        duration: musicData.duration,
        playUrl: musicData.playUrl,
      };
    } catch (error: any) {
      console.error('Failed to fetch song metadata from video:', {
        url: normalizedUrl,
        errorMessage: error.message,
        errorStack: error.stack,
        errorType: error.constructor.name
      });
      throw new Error(`Could not extract song metadata: ${error.message}`);
    }
  }

  /**
   * Extract video metadata from TikTok video URL
   * Uses dynamic import to avoid bundling playwright for client
   */
  async getVideoMetadata(url: string): Promise<VideoMetadata> {
    // Normalize URL to handle mobile/desktop/short links
    const normalizedUrl = await this.normalizeTikTokUrl(url);
    console.log('Fetching video from URL:', normalizedUrl);
    
    // Dynamic import - only loads when actually called (server-side only)
    const TikTokScraper = await import('tiktok-scraper-ts');
    const getVideoMeta = TikTokScraper.getVideoMeta || TikTokScraper.default?.getVideoMeta;
    
    if (!getVideoMeta) {
      throw new Error('getVideoMeta function not found in tiktok-scraper-ts');
    }
    
    try {
      const videoData = await getVideoMeta(normalizedUrl);
      
      return {
        id: videoData.id,
        description: videoData.description,
        song: {
          id: videoData.music.id,
          title: videoData.music.title,
          authorName: videoData.music.authorName,
          coverUrl: videoData.music.coverUrl,
          duration: videoData.music.duration,
          playUrl: videoData.music.playUrl,
        },
        author: videoData.author.uniqueId,
        authorNickname: videoData.author.nickname,
        createTime: videoData.createTime,
        stats: {
          views: videoData.playCount,
          likes: videoData.diggCount,
          comments: videoData.commentCount,
          shares: videoData.shareCount,
        },
        duration: videoData.duration,
      };
    } catch (error: any) {
      console.error('Failed to fetch video metadata:', error);
      throw new Error(`Could not extract video metadata: ${error.message}`);
    }
  }

  /**
   * Validate if a video uses the exact campaign song
   * NO fuzzy matching - exact ID and title match only
   */
  validateSongMatch(
    campaignSong: { id: string; title: string; authorName: string },
    videoSong: { id: string; title: string; authorName: string }
  ): { match: boolean; reason: string } {
    // Normalize for comparison (lowercase, remove extra spaces)
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

    // Priority 1: Compare IDs (most reliable)
    if (campaignSong.id && videoSong.id && campaignSong.id === videoSong.id) {
      return { match: true, reason: 'Exact song ID match' };
    }

    // Priority 2: Exact title and artist match (normalized)
    const campaignTitle = normalize(campaignSong.title);
    const videoTitle = normalize(videoSong.title);
    const campaignArtist = normalize(campaignSong.authorName);
    const videoArtist = normalize(videoSong.authorName);

    if (campaignTitle === videoTitle && campaignArtist === videoArtist) {
      return { match: true, reason: 'Exact title and artist match' };
    }

    // No match - provide detailed reason
    return {
      match: false,
      reason: `Wrong song detected. Expected: "${campaignSong.title}" by ${campaignSong.authorName}. Found: "${videoSong.title}" by ${videoSong.authorName}`,
    };
  }
}

// Export singleton instance
export const tiktokMetadata = new TikTokMetadataService();
