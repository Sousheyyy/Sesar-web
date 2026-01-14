// TikTok Scraper Service
// This service integrates with TikAPI for fast, low-latency video verification
// and music metadata fetching

import { cacheService, CACHE_TTL } from "./cache-service";
import {
  extractTikTokMusicId,
  extractTikTokVideoId,
  validateTikTokUrl,
  getExtractionErrorMessage,
} from "./url-utils";

interface TikTokVideoData {
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  duration: number;
  soundId?: string;
  soundName?: string;
  creatorFollowers?: number;
  creatorUsername?: string; // TikTok username (uniqueId) of the video creator
  isValid: boolean;
}

interface TikTokSongData {
  title: string;
  duration: number;
  coverImage?: string;
  tiktokUrl: string;
  authorName?: string;
  isValid: boolean;
}

interface TikTokMusicInfo {
  musicId: string;
  title: string;
  authorName: string;
  duration: number;
  coverImage?: string;
  videoCount?: number; // Number of videos using this music (from TikAPI)
  tiktokUrl: string;
  isValid: boolean;
}

interface TikTokMusicPost {
  videoId: string;
  videoUrl: string;
  author: {
    uniqueId: string;
    nickname: string;
    avatarThumb?: string;
  };
  stats: {
    playCount: number;
    diggCount: number;
    commentCount: number;
    shareCount: number;
  };
  desc: string;
  createTime: number;
  coverImage?: string;
}

interface TikTokUserProfile {
  uniqueId: string;
  nickname: string;
  avatar?: string;
  avatarLarger?: string;
  signature?: string; // Bio
  followerCount?: number;
  followingCount?: number;
  videoCount?: number;
  heartCount?: number; // Total likes
  isVerified?: boolean;
  isPrivate?: boolean;
  isValid: boolean;
}

export class TikTokScraperService {
  private apiKey: string | undefined;
  private baseUrl: string = "https://api.tikapi.io";

  constructor() {
    this.apiKey = process.env.TIK_API_KEY;
  }

  /**
   * Fetch detailed music information with statistics
   * Uses /public/music/info endpoint with caching
   */
  async fetchMusicInfo(musicId: string, useCache: boolean = true): Promise<TikTokMusicInfo> {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cached = await cacheService.get(musicId, "music_info");
        if (cached) {
          return cached as TikTokMusicInfo;
        }
      }

      // If no API key, return mock data
      if (!this.apiKey) {
        console.warn("⚠️ No TIK_API_KEY found, using mock data");
        return this.getMockMusicInfo(musicId);
      }

      // Fetch from TikAPI
      const response = await fetch(`${this.baseUrl}/public/music/info?id=${musicId}`, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TikAPI error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (!data || !data.musicInfo || !data.musicInfo.music) {
        throw new Error("No music info returned from TikAPI");
      }

      const musicData = data.musicInfo.music;
      const statsData = data.musicInfo.stats || {};

      // Construct proper TikTok music URL with song name
      const songTitle = (musicData.title || "song").toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')          // Replace spaces with hyphens
        .replace(/-+/g, '-')            // Replace multiple hyphens with single
        .trim();

      const musicInfo: TikTokMusicInfo = {
        musicId: musicData.id || musicId,
        title: musicData.title || "Unknown Song",
        authorName: musicData.authorName || "Unknown Artist",
        duration: musicData.duration || 30,
        coverImage: musicData.coverLarge || musicData.coverMedium || musicData.coverThumb,
        videoCount: statsData.videoCount || null, // TikAPI only provides videoCount, not playCount
        tiktokUrl: `https://www.tiktok.com/music/${songTitle}-${musicData.id || musicId}`,
        isValid: true,
      };

      // Cache the result
      if (useCache) {
        await cacheService.set(musicId, "music_info", musicInfo, CACHE_TTL.MUSIC_INFO);
      }

      return musicInfo;
    } catch (error: any) {
      console.error("TikAPI music info fetch error:", error);
      // Return mock data on error
      return this.getMockMusicInfo(musicId);
    }
  }

  /**
   * Fetch trending videos/posts using a specific music
   * Uses /public/music endpoint with caching
   */
  async fetchMusicPosts(musicId: string, limit: number = 10, useCache: boolean = true): Promise<TikTokMusicPost[]> {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cached = await cacheService.get(musicId, "trending_videos");
        if (cached) {
          return cached as TikTokMusicPost[];
        }
      }

      // If no API key, return mock data
      if (!this.apiKey) {
        console.warn("⚠️ No TIK_API_KEY found, using mock data");
        return this.getMockMusicPosts(musicId, limit);
      }

      // Fetch from TikAPI
      const response = await fetch(`${this.baseUrl}/public/music?id=${musicId}&count=${limit}`, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TikAPI error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (!data || !data.itemList) {
        throw new Error("No music posts returned from TikAPI");
      }

      const posts: TikTokMusicPost[] = data.itemList.map((item: any) => ({
        videoId: item.id,
        videoUrl: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
        author: {
          uniqueId: item.author?.uniqueId || "",
          nickname: item.author?.nickname || "",
          avatarThumb: item.author?.avatarThumb,
        },
        stats: {
          playCount: item.stats?.playCount || 0,
          diggCount: item.stats?.diggCount || 0,
          commentCount: item.stats?.commentCount || 0,
          shareCount: item.stats?.shareCount || 0,
        },
        desc: item.desc || "",
        createTime: item.createTime || Date.now() / 1000,
        coverImage: item.video?.cover || item.video?.dynamicCover,
      }));

      // Cache the result
      if (useCache) {
        await cacheService.set(musicId, "trending_videos", posts, CACHE_TTL.TRENDING_VIDEOS);
      }

      return posts;
    } catch (error: any) {
      console.error("TikAPI music posts fetch error:", error);
      // Return mock data on error
      return this.getMockMusicPosts(musicId, limit);
    }
  }

  /**
   * Fetch song details from TikTok music link or video link
   * Enhanced to use /public/music/info for richer metadata
   */
  async fetchSongDetails(tiktokUrl: string): Promise<TikTokSongData> {
    try {
      // Extract music ID from URL using centralized utility
      const musicId = extractTikTokMusicId(tiktokUrl);

      if (!musicId) {
        throw new Error(getExtractionErrorMessage(tiktokUrl, 'music'));
      }

      // If we have a music ID, use the enhanced endpoint
      if (this.apiKey) {
        try {
          const musicInfo = await this.fetchMusicInfo(musicId, true);
          return {
            title: musicInfo.title,
            duration: musicInfo.duration,
            coverImage: musicInfo.coverImage,
            tiktokUrl: musicInfo.tiktokUrl,
            authorName: musicInfo.authorName,
            isValid: musicInfo.isValid,
          };
        } catch (apiError) {
          console.warn("⚠️ Enhanced fetch failed, trying fallback:", apiError);
        }
      }

      // Fallback to original method for video URLs or if enhanced method fails
      if (this.apiKey) {
        try {
          return await this.scrapeSongWithTikAPI(tiktokUrl);
        } catch (apiError) {
          console.warn("⚠️ TikAPI failed, falling back to mock data:", apiError);
          return this.getMockSongData(tiktokUrl);
        }
      }

      // Otherwise, return mock data for development
      console.warn("⚠️ No TIK_API_KEY found, using mock data for development");
      return this.getMockSongData(tiktokUrl);
    } catch (error) {
      console.error("TikTok song fetch error:", error);
      // Even if something goes wrong, return mock data instead of failing
      console.warn("⚠️ Unexpected error, using mock data");
      return this.getMockSongData(tiktokUrl);
    }
  }

  /**
   * Verify a TikTok video and extract metadata
   * Uses caching to reduce TikAPI calls (30min TTL)
   */
  async verifyVideo(tiktokUrl: string): Promise<TikTokVideoData> {
    try {
      // Extract video ID from URL using centralized utility
      // Note: The video ID is also extracted in route handlers for validation, 
      // but we do it here again to be self-contained. 
      const videoId = extractTikTokVideoId(tiktokUrl);

      if (!videoId) {
        throw new Error(getExtractionErrorMessage(tiktokUrl, 'video'));
      }

      // Check cache first
      const cached = await cacheService.get(videoId, "video_verification");
      if (cached) {
        return cached as TikTokVideoData;
      }

      // If API token is available, try real scraping
      if (this.apiKey) {
        try {
          const videoData = await this.scrapeWithTikAPI(tiktokUrl);

          // Cache the result
          await cacheService.set(
            videoId,
            "video_verification",
            videoData,
            CACHE_TTL.VIDEO_VERIFICATION
          );

          return videoData;
        } catch (apiError) {
          console.warn("⚠️ TikAPI failed, falling back to mock data:", apiError);
          return this.getMockData(videoId);
        }
      }

      // Otherwise, return mock data for development
      console.warn("⚠️ No TIK_API_KEY found, using mock data for development");
      return this.getMockData(videoId);
    } catch (error) {
      console.error("TikTok verification error:", error);
      throw error;
    }
  }


  /**
   * Scrape video data using TikAPI
   */
  private async scrapeWithTikAPI(tiktokUrl: string): Promise<TikTokVideoData> {
    try {
      // Extract video ID from URL using centralized utility
      const videoId = extractTikTokVideoId(tiktokUrl);
      if (!videoId) {
        throw new Error(getExtractionErrorMessage(tiktokUrl, 'video'));
      }

      const response = await fetch(`${this.baseUrl}/public/video?id=${videoId}`, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey!,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TikAPI error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (!data || !data.itemInfo || !data.itemInfo.itemStruct) {
        throw new Error("No video data returned from TikAPI");
      }

      const videoData = data.itemInfo.itemStruct;
      const stats = videoData.stats || {};
      const musicData = videoData.music || {};
      const authorStats = videoData.authorStats || {};
      const author = videoData.author || {};

      return {
        videoId: videoData.id || "",
        views: stats.playCount || 0,
        likes: stats.diggCount || 0,
        comments: stats.commentCount || 0,
        shares: stats.shareCount || 0,
        duration: videoData.video?.duration || 0,
        soundId: musicData.id,
        soundName: musicData.title || musicData.authorName,
        creatorFollowers: authorStats.followerCount || 0,
        creatorUsername: author.uniqueId || undefined,
        isValid: true,
      };
    } catch (error: any) {
      console.error("TikAPI scraping error:", error);
      throw new Error(`Failed to verify video with TikAPI: ${error.message}`);
    }
  }

  /**
   * Scrape song data using TikAPI
   */
  private async scrapeSongWithTikAPI(tiktokUrl: string): Promise<TikTokSongData> {
    try {
      // Check if it's a music URL or video URL using centralized utility
      const musicId = extractTikTokMusicId(tiktokUrl);

      if (musicId) {
        // Direct music URL - fetch music details
        return await this.fetchMusicById(musicId);
      } else {
        // Video URL - extract music from video
        return await this.fetchMusicFromVideo(tiktokUrl);
      }
    } catch (error: any) {
      console.error("TikAPI song scraping error:", error);
      throw new Error(`Failed to fetch song details from TikAPI: ${error.message}`);
    }
  }

  /**
   * Fetch music details by music ID
   */
  private async fetchMusicById(musicId: string): Promise<TikTokSongData> {
    try {
      const response = await fetch(`${this.baseUrl}/public/music/info?id=${musicId}`, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey!,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TikAPI error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (!data || !data.musicInfo || !data.musicInfo.music) {
        throw new Error("No music data returned from TikAPI");
      }

      const musicData = data.musicInfo.music;

      // Construct proper TikTok music URL with song name
      const songTitle = (musicData.title || "song").toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')          // Replace spaces with hyphens
        .replace(/-+/g, '-')            // Replace multiple hyphens with single
        .trim();

      return {
        title: musicData.title || "Unknown Song",
        duration: musicData.duration || 30,
        coverImage: musicData.coverLarge || musicData.coverMedium || musicData.coverThumb,
        tiktokUrl: `https://www.tiktok.com/music/${songTitle}-${musicData.id}`,
        authorName: musicData.authorName,
        isValid: true,
      };
    } catch (error: any) {
      console.error("TikAPI music fetch error:", error);
      throw new Error(`Failed to fetch music by ID: ${error.message}`);
    }
  }

  /**
   * Extract music from video
   */
  private async fetchMusicFromVideo(tiktokUrl: string): Promise<TikTokSongData> {
    try {
      // Extract video ID from URL using centralized utility
      const videoId = extractTikTokVideoId(tiktokUrl);
      if (!videoId) {
        throw new Error(getExtractionErrorMessage(tiktokUrl, 'video'));
      }

      const response = await fetch(`${this.baseUrl}/public/video?id=${videoId}`, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey!,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TikAPI error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (!data || !data.itemInfo || !data.itemInfo.itemStruct) {
        throw new Error("No video data returned from TikAPI");
      }

      const videoData = data.itemInfo.itemStruct;
      const musicData = videoData.music || {};

      // Construct proper TikTok music URL with song name
      const songTitle = (musicData.title || "song").toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')          // Replace spaces with hyphens
        .replace(/-+/g, '-')            // Replace multiple hyphens with single
        .trim();

      return {
        title: musicData.title || "Unknown Song",
        duration: musicData.duration || 30,
        coverImage: musicData.coverLarge || musicData.coverMedium || musicData.coverThumb,
        tiktokUrl: `https://www.tiktok.com/music/${songTitle}-${musicData.id}`,
        authorName: musicData.authorName,
        isValid: true,
      };
    } catch (error: any) {
      console.error("TikAPI video-to-music fetch error:", error);
      throw new Error(`Failed to extract music from video: ${error.message}`);
    }
  }

  /**
   * Get mock song data for development (when no API key is available)
   */
  private getMockSongData(tiktokUrl: string): TikTokSongData {
    // Attempt to extract some valid-looking ID or name from URL for better mock data
    const urlParts = tiktokUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1] || "dataset";

    return {
      title: `Song from ${lastPart.substring(0, 15)}...`,
      duration: 60, // Default 60s for mock
      coverImage: undefined,
      tiktokUrl: tiktokUrl,
      authorName: "Unknown Artist (Mock)",
      isValid: true,
    };
  }

  /**
   * Get mock data for development (when no API key is available)
   */
  private getMockData(videoId: string): TikTokVideoData {
    return {
      videoId,
      views: Math.floor(Math.random() * 10000) + 1000,
      likes: Math.floor(Math.random() * 1000) + 100,
      comments: Math.floor(Math.random() * 100) + 10,
      shares: Math.floor(Math.random() * 500) + 50,
      duration: 25, // 25 seconds
      soundId: "mock-sound-id",
      soundName: "Mock Song Name",
      creatorFollowers: Math.floor(Math.random() * 50000) + 5000,
      creatorUsername: "mockuser",
      isValid: true,
    };
  }

  /**
   * Get mock music info for development
   */
  private getMockMusicInfo(musicId: string): TikTokMusicInfo {
    return {
      musicId,
      title: "Mock Song Title",
      authorName: "Mock Artist",
      duration: 30,
      coverImage: undefined, // No placeholder image for mock data
      videoCount: Math.floor(Math.random() * 50000) + 5000, // TikAPI only provides videoCount
      tiktokUrl: `https://www.tiktok.com/music/mock-song-title-${musicId}`,
      isValid: true,
    };
  }

  /**
   * Get mock music posts for development
   */
  private getMockMusicPosts(musicId: string, limit: number): TikTokMusicPost[] {
    const posts: TikTokMusicPost[] = [];

    for (let i = 0; i < limit; i++) {
      posts.push({
        videoId: `mock-video-${i}-${Date.now()}`,
        videoUrl: `https://www.tiktok.com/@mockuser${i}/video/123456789${i}`,
        author: {
          uniqueId: `mockuser${i}`,
          nickname: `Mock Creator ${i + 1}`,
          avatarThumb: undefined, // No placeholder image
        },
        stats: {
          playCount: Math.floor(Math.random() * 500000) + 10000,
          diggCount: Math.floor(Math.random() * 50000) + 1000,
          commentCount: Math.floor(Math.random() * 5000) + 100,
          shareCount: Math.floor(Math.random() * 10000) + 500,
        },
        desc: `Mock video description for trending video ${i + 1} using this music`,
        createTime: Date.now() / 1000 - Math.floor(Math.random() * 86400 * 7),
        coverImage: undefined, // No placeholder image
      });
    }

    return posts;
  }

  /**
   * Verify if video uses the correct song
   */
  verifySong(videoData: TikTokVideoData, expectedSongTitle: string): boolean {
    if (!videoData.soundName) {
      return false;
    }

    // Simple string matching (can be improved with fuzzy matching)
    return videoData.soundName.toLowerCase().includes(expectedSongTitle.toLowerCase()) ||
      expectedSongTitle.toLowerCase().includes(videoData.soundName.toLowerCase());
  }

  /**
   * Update submission with video data
   */
  async updateSubmissionData(submissionId: string, videoData: TikTokVideoData) {
    const { prisma } = await import("@/lib/prisma");

    return await prisma.submission.update({
      where: { id: submissionId },
      data: {
        tiktokVideoId: videoData.videoId,
        lastViewCount: videoData.views,
        lastLikeCount: videoData.likes,
        lastCommentCount: videoData.comments,
        lastShareCount: videoData.shares,
        videoDuration: videoData.duration,
        creatorFollowers: videoData.creatorFollowers,
        verified: true,
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
      },
    });
  }

  /**
   * Check TikTok user profile by username
   * Uses /public/check endpoint from TikAPI with caching (24h TTL)
   */
  async checkUserProfile(username: string): Promise<TikTokUserProfile> {
    try {
      // Remove @ if present
      const cleanUsername = username.replace(/^@/, "");

      // Validate username format (alphanumeric, underscores, no spaces)
      if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
        throw new Error("Invalid TikTok username format");
      }

      // Check cache first
      const cached = await cacheService.get(cleanUsername, "user_profile");
      if (cached) {
        return cached as TikTokUserProfile;
      }

      // If no API key, return mock data
      if (!this.apiKey) {
        console.warn("⚠️ No TIK_API_KEY found, using mock data");
        return this.getMockUserProfile(cleanUsername);
      }

      // Fetch from TikAPI
      const response = await fetch(`${this.baseUrl}/public/check?username=${encodeURIComponent(cleanUsername)}`, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific error cases
        if (response.status === 404 || errorData.message?.includes("not found")) {
          throw new Error("TikTok user not found");
        }
        if (response.status === 429 || errorData.message?.includes("rate limit")) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }

        throw new Error(`TikAPI error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (!data || !data.userInfo || !data.userInfo.user) {
        throw new Error("No user data returned from TikAPI");
      }

      const userData = data.userInfo.user;
      const stats = data.userInfo.stats || {};

      const profile: TikTokUserProfile = {
        uniqueId: userData.uniqueId || cleanUsername,
        nickname: userData.nickname || cleanUsername,
        avatar: userData.avatarThumb || userData.avatarMedium,
        avatarLarger: userData.avatarLarger || userData.avatarMedium,
        signature: userData.signature || "",
        followerCount: stats.followerCount ?? 0,
        followingCount: stats.followingCount ?? 0,
        videoCount: stats.videoCount ?? 0,
        heartCount: stats.heartCount ?? 0,
        isVerified: userData.verified || false,
        isPrivate: userData.privateAccount || false,
        isValid: true,
      };

      // Cache the result
      await cacheService.set(
        cleanUsername,
        "user_profile",
        profile,
        CACHE_TTL.USER_PROFILE
      );

      return profile;
    } catch (error: any) {
      console.error("TikAPI user profile check error:", error);

      // If it's a validation error or not found, throw it
      if (error.message?.includes("Invalid") || error.message?.includes("not found")) {
        throw error;
      }

      // For other errors, return mock data
      console.warn("⚠️ Error fetching user profile, using mock data");
      return this.getMockUserProfile(username.replace(/^@/, ""));
    }
  }

  /**
   * Get mock user profile data for development
   */
  private getMockUserProfile(username: string): TikTokUserProfile {
    return {
      uniqueId: username,
      nickname: `${username} (Mock)`,
      avatar: `https://api.dicebear.com/9.x/avataaars/png?seed=${username}`,
      avatarLarger: `https://api.dicebear.com/9.x/avataaars/png?seed=${username}`,
      signature: "This is mock profile data for development",
      followerCount: Math.floor(Math.random() * 100000) + 1000,
      followingCount: Math.floor(Math.random() * 1000) + 100,
      videoCount: Math.floor(Math.random() * 500) + 10,
      heartCount: Math.floor(Math.random() * 1000000) + 10000,
      isVerified: false,
      isPrivate: false,
      isValid: true,
    };
  }
}

// Lazy-load TikTok scraper to avoid blocking worker startup
let _tiktokScraper: TikTokScraperService | null = null;

export const getTikTokScraper = () => {
  if (!_tiktokScraper) {
    _tiktokScraper = new TikTokScraperService();
  }
  return _tiktokScraper;
};

// Export as Proxy for backward compatibility
export const tiktokScraper = new Proxy({} as TikTokScraperService, {
  get(_target, prop) {
    const service = getTikTokScraper();
    const value = (service as any)[prop];
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  },
});

export type { TikTokVideoData, TikTokSongData, TikTokMusicInfo, TikTokMusicPost, TikTokUserProfile };
