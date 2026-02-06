/**
 * TikTok URL Utilities
 * Helper functions to parse TikTok URLs and extract IDs
 */

/**
 * Extract music ID from TikTok music URL
 * Example: https://www.tiktok.com/music/Song-Name-7123456789012345678
 * Returns: 7123456789012345678
 */
export function extractMusicId(url: string): string | null {
    try {
        // Pattern: /music/[song-name]-[music_id]
        const match = url.match(/\/music\/[^/]+-(\d+)/);
        return match ? match[1] : null;
    } catch (error) {
        console.error('Error extracting music ID:', error);
        return null;
    }
}

/**
 * Extract video ID from TikTok video URL
 * Example: https://www.tiktok.com/@username/video/7350123456789012345
 * Returns: 7350123456789012345
 */
export function extractVideoId(url: string): string | null {
    try {
        // Pattern: /video/[video_id]
        const match = url.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
    } catch (error) {
        console.error('Error extracting video ID:', error);
        return null;
    }
}

/**
 * Extract username from TikTok profile or video URL
 * Example 1: https://www.tiktok.com/@username
 * Example 2: https://www.tiktok.com/@username/video/123
 * Returns: username
 */
export function extractUsername(url: string): string | null {
    try {
        // Pattern: /@[username]
        const match = url.match(/@([^/]+)/);
        return match ? match[1] : null;
    } catch (error) {
        console.error('Error extracting username:', error);
        return null;
    }
}

/**
 * Validate if URL is a valid TikTok music URL
 */
export function isTikTokMusicUrl(url: string): boolean {
    return url.includes('tiktok.com/music/');
}

/**
 * Validate if URL is a valid TikTok video URL
 */
export function isTikTokVideoUrl(url: string): boolean {
    return url.includes('tiktok.com/@') && url.includes('/video/');
}

/**
 * Normalize TikTok URL (handle mobile/desktop variants)
 * Converts vm.tiktok.com or m.tiktok.com to www.tiktok.com
 */
export function normalizeTikTokUrl(url: string): string {
    return url
        .replace('vm.tiktok.com', 'www.tiktok.com')
        .replace('m.tiktok.com', 'www.tiktok.com');
}
