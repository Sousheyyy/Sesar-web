/**
 * TikTok URL Utilities
 * Centralized utilities for extracting and validating TikTok video and music IDs
 */

/**
 * Result of URL validation
 */
export interface TikTokUrlValidation {
  isValid: boolean;
  type: 'video' | 'music' | 'shortlink' | 'unknown';
  error?: string;
}

/**
 * Result of ID extraction with metadata
 */
export interface ExtractedId {
  id: string;
  type: 'video' | 'music' | 'shortlink';
  originalUrl: string;
  isValid: boolean;
  error?: string;
}

/**
 * Normalize a TikTok URL by removing trailing slashes, fragments, etc.
 * @param url - The URL to normalize
 * @returns Normalized URL string
 */
export function normalizeTikTokUrl(url: string): string {
  try {
    // Trim whitespace
    let normalized = url.trim();

    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');

    // Remove URL fragments (#section)
    normalized = normalized.split('#')[0];

    return normalized;
  } catch (error) {
    return url;
  }
}

/**
 * Extract TikTok music ID from a URL
 * Supports formats:
 * - https://www.tiktok.com/music/Song-Name-7565543138765392652
 * - https://www.tiktok.com/music/original-sound-1234567890
 * - https://vm.tiktok.com/ABC123/
 * - ?musicId=1234567890
 * 
 * @param url - The TikTok music URL
 * @returns Music ID (numeric string) or short link, null if extraction fails
 */
export function extractTikTokMusicId(url: string): string | null {
  try {


    // Normalize URL
    const normalized = normalizeTikTokUrl(url);

    // Pattern 1: Full music URLs - /music/song-name-[ID]
    // Handles: https://www.tiktok.com/music/Khim-10s-7565543138765392652
    const musicUrlPattern = /\/music\/[^\/\?#]+-(\d+)/i;
    const musicMatch = normalized.match(musicUrlPattern);
    if (musicMatch && musicMatch[1]) {
      const id = musicMatch[1];


      // Validate ID (TikTok IDs are typically 10-20 digits)
      if (id.length >= 6 && id.length <= 25) {
        return id;
      } else {
        console.warn("⚠️ Music ID length unusual:", id.length, "digits");
        return id; // Return anyway but log warning
      }
    }

    // Pattern 2: Query parameter - ?musicId=1234567890
    const queryPattern = /[?&]musicId=(\d+)/i;
    const queryMatch = normalized.match(queryPattern);
    if (queryMatch && queryMatch[1]) {
      const id = queryMatch[1];

      return id;
    }

    // Pattern 3: Short links - vm.tiktok.com/ABC or vt.tiktok.com/ABC
    // TikAPI can resolve these directly
    const shortLinkPattern = /(v[mt]\.tiktok\.com\/[A-Za-z0-9]+)/i;
    const shortMatch = normalized.match(shortLinkPattern);
    if (shortMatch && shortMatch[1]) {
      const shortLink = shortMatch[1];

      return shortLink;
    }

    console.warn("❌ Failed to extract Music ID from:", url);
    return null;
  } catch (error) {
    console.error("Error extracting music ID:", error);
    return null;
  }
}

/**
 * Extract TikTok video ID from a URL
 * Supports formats:
 * - https://www.tiktok.com/@username/video/7003402629929913605
 * - https://vt.tiktok.com/ZSabcdefg/
 * - https://vm.tiktok.com/ZMabcdefg/
 * 
 * @param url - The TikTok video URL
 * @returns Video ID (numeric string) or short link, null if extraction fails
 */
export function extractTikTokVideoId(url: string): string | null {
  try {


    // Normalize URL
    const normalized = normalizeTikTokUrl(url);

    // Pattern 1: Full video URLs - /@username/video/[ID]
    // Handles: https://www.tiktok.com/@hayleybuix/video/7003402629929913605
    const videoUrlPattern = /\/video\/(\d+)/i;
    const videoMatch = normalized.match(videoUrlPattern);
    if (videoMatch && videoMatch[1]) {
      const id = videoMatch[1];


      // Validate ID (TikTok IDs are typically 10-20 digits)
      if (id.length >= 6 && id.length <= 25) {
        return id;
      } else {
        console.warn("⚠️ Video ID length unusual:", id.length, "digits");
        return id; // Return anyway but log warning
      }
    }

    // Pattern 2: Short links - vm.tiktok.com/ABC or vt.tiktok.com/ABC
    // TikAPI can resolve these directly
    const shortLinkPattern = /(v[mt]\.tiktok\.com\/[A-Za-z0-9]+)/i;
    const shortMatch = normalized.match(shortLinkPattern);
    if (shortMatch && shortMatch[1]) {
      const shortLink = shortMatch[1];

      return shortLink;
    }

    console.warn("❌ Failed to extract Video ID from:", url);
    return null;
  } catch (error) {
    console.error("Error extracting video ID:", error);
    return null;
  }
}

/**
 * Validate a TikTok URL and determine its type
 * @param url - The URL to validate
 * @returns Validation result with type information
 */
export function validateTikTokUrl(url: string): TikTokUrlValidation {
  try {
    // Check if URL contains tiktok.com
    if (!url.includes('tiktok.com')) {
      return {
        isValid: false,
        type: 'unknown',
        error: 'URL must be from tiktok.com',
      };
    }

    // Try to extract music ID
    const musicId = extractTikTokMusicId(url);
    if (musicId) {
      return {
        isValid: true,
        type: musicId.includes('tiktok.com') ? 'shortlink' : 'music',
      };
    }

    // Try to extract video ID
    const videoId = extractTikTokVideoId(url);
    if (videoId) {
      return {
        isValid: true,
        type: videoId.includes('tiktok.com') ? 'shortlink' : 'video',
      };
    }

    // Could not extract any ID
    return {
      isValid: false,
      type: 'unknown',
      error: 'Could not extract ID from URL. Expected format: https://www.tiktok.com/music/... or @user/video/...',
    };
  } catch (error) {
    return {
      isValid: false,
      type: 'unknown',
      error: `URL validation error: ${error}`,
    };
  }
}

/**
 * Extract ID with full metadata
 * @param url - The TikTok URL
 * @param type - The expected type ('music' or 'video')
 * @returns Extraction result with metadata
 */
export function extractTikTokId(
  url: string,
  type: 'music' | 'video'
): ExtractedId {
  const originalUrl = url;

  const extractFn = type === 'music' ? extractTikTokMusicId : extractTikTokVideoId;
  const id = extractFn(url);

  if (!id) {
    return {
      id: '',
      type,
      originalUrl,
      isValid: false,
      error: `Failed to extract ${type} ID from URL. Check URL format.`,
    };
  }

  return {
    id,
    type: id.includes('tiktok.com') ? 'shortlink' : type,
    originalUrl,
    isValid: true,
  };
}

/**
 * Extract TikTok username from a video URL
 * Supports formats:
 * - https://www.tiktok.com/@username/video/7003402629929913605
 * 
 * Note: Short links (vm.tiktok.com, vt.tiktok.com) cannot extract username from URL
 * and will return null. Use the API response creatorUsername field instead.
 * 
 * @param url - The TikTok video URL
 * @returns Username (without @) or null if extraction fails
 */
export function extractTikTokUsernameFromUrl(url: string): string | null {
  try {
    // Normalize URL
    const normalized = normalizeTikTokUrl(url);

    // Pattern: /@username/video/ or /@username/
    // Handles: https://www.tiktok.com/@hayleybuix/video/7003402629929913605
    const usernamePattern = /\/@([a-zA-Z0-9._]+)/i;
    const usernameMatch = normalized.match(usernamePattern);

    if (usernameMatch && usernameMatch[1]) {
      const username = usernameMatch[1];
      // Validate username format (alphanumeric, underscores, dots, no spaces)
      if (/^[a-zA-Z0-9._]+$/.test(username)) {
        return username.toLowerCase().trim();
      }
    }

    // Short links don't contain username in URL
    if (/v[mt]\.tiktok\.com/i.test(normalized)) {
      return null;
    }

    return null;
  } catch (error) {
    console.error("Error extracting username from URL:", error);
    return null;
  }
}

/**
 * Get user-friendly error message for failed extraction
 * @param url - The URL that failed
 * @param type - The expected type
 * @returns User-friendly error message
 */
export function getExtractionErrorMessage(
  url: string,
  type: 'music' | 'video'
): string {
  if (!url.includes('tiktok.com')) {
    return 'Please provide a valid TikTok URL';
  }

  if (type === 'music') {
    return 'Music ID not found. Please use a URL format like: https://www.tiktok.com/music/Song-Name-1234567890';
  }

  return 'Video ID not found. Please use a URL format like: https://www.tiktok.com/@username/video/1234567890';
}







