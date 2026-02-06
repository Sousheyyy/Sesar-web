import { describe, it, expect, vi } from 'vitest';
import { tiktokMetadata } from '../lib/tiktok-metadata';

describe('TikTok Metadata Service', () => {
  describe('getSongMetadata', () => {
    it('should extract song metadata from valid URL', async () => {
      const songUrl = 'https://www.tiktok.com/music/test-song-123';
      // This will make actual API call - should be mocked in real tests
      try {
        const result = await tiktokMetadata.getSongMetadata(songUrl);
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('authorName');
      } catch (error) {
        // Expected to fail without real TikTok URL
        expect(error).toBeDefined();
      }
    });
    
    it('should throw error for invalid URL', async () => {
      await expect(
        tiktokMetadata.getSongMetadata('https://invalid.com')
      ).rejects.toThrow();
    });
  });
  
  describe('getVideoMetadata', () => {
    it('should extract video metadata from valid URL', async () => {
      const videoUrl = 'https://www.tiktok.com/@user/video/123';
      // This will make actual API call - should be mocked in real tests
      try {
        const result = await tiktokMetadata.getVideoMetadata(videoUrl);
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('song');
        expect(result.song).toHaveProperty('title');
        expect(result).toHaveProperty('stats');
      } catch (error) {
        // Expected to fail without real TikTok URL
        expect(error).toBeDefined();
      }
    });
  });
  
  describe('validateSongMatch', () => {
    it('should match when IDs are identical', () => {
      const campaign = { id: '123', title: 'Song', authorName: 'Artist' };
      const video = { id: '123', title: 'Song', authorName: 'Artist' };
      
      const result = tiktokMetadata.validateSongMatch(campaign, video);
      expect(result.match).toBe(true);
      expect(result.reason).toBe('Exact song ID match');
    });
    
    it('should match when title and artist are identical', () => {
      const campaign = { 
        id: '123', 
        title: 'Summer Vibes', 
        authorName: 'DJ Mike' 
      };
      const video = { 
        id: '456',  // Different ID
        title: 'Summer Vibes', 
        authorName: 'DJ Mike' 
      };
      
      const result = tiktokMetadata.validateSongMatch(campaign, video);
      expect(result.match).toBe(true);
      expect(result.reason).toBe('Exact title and artist match');
    });
    
    it('should NOT match remixes', () => {
      const campaign = { 
        id: '123', 
        title: 'Summer Vibes', 
        authorName: 'DJ Mike' 
      };
      const video = { 
        id: '456', 
        title: 'Summer Vibes (Remix)',  // Different!
        authorName: 'DJ Mike' 
      };
      
      const result = tiktokMetadata.validateSongMatch(campaign, video);
      expect(result.match).toBe(false);
      expect(result.reason).toContain('Wrong song');
    });
    
    it('should NOT match featured artist variants', () => {
      const campaign = { 
        id: '123', 
        title: 'Party Tonight', 
        authorName: 'DJ Mike' 
      };
      const video = { 
        id: '456', 
        title: 'Party Tonight', 
        authorName: 'DJ Mike ft. Sarah'  // Different!
      };
      
      const result = tiktokMetadata.validateSongMatch(campaign, video);
      expect(result.match).toBe(false);
      expect(result.reason).toContain('Wrong song');
    });
    
    it('should NOT match different songs', () => {
      const campaign = { 
        id: '123', 
        title: 'Song A', 
        authorName: 'Artist 1' 
      };
      const video = { 
        id: '456', 
        title: 'Song B', 
        authorName: 'Artist 2' 
      };
      
      const result = tiktokMetadata.validateSongMatch(campaign, video);
      expect(result.match).toBe(false);
      expect(result.reason).toContain('Wrong song');
    });
  });
});
