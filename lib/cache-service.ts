// Cache Service for TikAPI Responses
// Manages caching of music info and trending videos to optimize API usage

import { prisma } from "@/lib/prisma";

export interface CacheEntry {
  data: any;
  expiresAt: Date;
}

export type CacheType = "trending_videos" | "music_info" | "video_verification" | "user_profile";

export class CacheService {
  /**
   * Get cached data if available and not expired
   */
  async get(
    tiktokMusicId: string,
    cacheType: CacheType
  ): Promise<any | null> {
    try {
      const cache = await prisma.musicCache.findFirst({
        where: {
          tiktokMusicId,
          cacheType,
          expiresAt: {
            gt: new Date(), // Only get non-expired cache
          },
        },
        orderBy: {
          createdAt: "desc", // Get most recent
        },
      });

      if (!cache) {
        return null;
      }


      return cache.data;
    } catch (error) {
      console.error("Cache retrieval error:", error);
      return null;
    }
  }

  /**
   * Store data in cache with expiration
   */
  async set(
    tiktokMusicId: string,
    cacheType: CacheType,
    data: any,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await prisma.musicCache.create({
        data: {
          tiktokMusicId,
          cacheType,
          data,
          expiresAt,
        },
      });


    } catch (error) {
      console.error("Cache storage error:", error);
      // Non-critical error - don't throw
    }
  }

  /**
   * Invalidate (delete) cache for a specific music ID and type
   */
  async invalidate(
    tiktokMusicId: string,
    cacheType?: CacheType
  ): Promise<void> {
    try {
      const where: any = { tiktokMusicId };
      if (cacheType) {
        where.cacheType = cacheType;
      }

      await prisma.musicCache.deleteMany({
        where,
      });


    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  /**
   * Clean up expired cache entries
   * Should be run periodically (e.g., daily cron job)
   */
  async cleanExpired(): Promise<number> {
    try {
      const result = await prisma.musicCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      const count = result.count;

      return count;
    } catch (error) {
      console.error("Cache cleanup error:", error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    musicInfoCount: number;
    trendingVideosCount: number;
    expiredCount: number;
  }> {
    try {
      // Reduce concurrent queries to avoid connection pool exhaustion
      const total = await prisma.musicCache.count();
      const [musicInfo, trendingVideos, expired] = await Promise.all([
        prisma.musicCache.count({ where: { cacheType: "music_info" } }),
        prisma.musicCache.count({ where: { cacheType: "trending_videos" } }),
        prisma.musicCache.count({
          where: { expiresAt: { lt: new Date() } },
        }),
      ]);

      return {
        totalEntries: total,
        musicInfoCount: musicInfo,
        trendingVideosCount: trendingVideos,
        expiredCount: expired,
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        totalEntries: 0,
        musicInfoCount: 0,
        trendingVideosCount: 0,
        expiredCount: 0,
      };
    }
  }

  /**
   * Check if cache exists and is valid
   */
  async exists(tiktokMusicId: string, cacheType: CacheType): Promise<boolean> {
    try {
      const cache = await prisma.musicCache.findFirst({
        where: {
          tiktokMusicId,
          cacheType,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      return cache !== null;
    } catch (error) {
      console.error("Cache exists check error:", error);
      return false;
    }
  }
}

// Lazy-load cache service to avoid blocking worker startup
let _cacheService: CacheService | null = null;

export const getCacheService = () => {
  if (!_cacheService) {
    _cacheService = new CacheService();
  }
  return _cacheService;
};

// Export as Proxy for backward compatibility
export const cacheService = new Proxy({} as CacheService, {
  get(_target, prop) {
    const service = getCacheService();
    const value = (service as any)[prop];
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  },
});

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  MUSIC_INFO: 24 * 60 * 60, // 24 hours
  TRENDING_VIDEOS: 60 * 60, // 1 hour
  VIDEO_VERIFICATION: 30 * 60, // 30 minutes
  USER_PROFILE: 24 * 60 * 60, // 24 hours
};







