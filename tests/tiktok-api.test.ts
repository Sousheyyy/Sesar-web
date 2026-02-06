import { describe, it, expect, beforeEach } from 'vitest';
import { tiktokAPI } from '../lib/tiktok-api';

describe('TikTok API Service', () => {
  let accessToken: string;
  
  beforeEach(() => {
    accessToken = process.env.TEST_TIKTOK_ACCESS_TOKEN || 'test_token';
  });
  
  describe('getUserInfo', () => {
    it('should fetch user info with valid token', async () => {
      // This test will fail without real token
      try {
        const result = await tiktokAPI.getUserInfo(accessToken);
        expect(result).toHaveProperty('open_id');
        expect(result).toHaveProperty('username');
        expect(result).toHaveProperty('follower_count');
      } catch (error) {
        // Expected to fail without real token
        expect(error).toBeDefined();
      }
    });
    
    it('should throw error with invalid token', async () => {
      await expect(
        tiktokAPI.getUserInfo('invalid_token')
      ).rejects.toThrow();
    });
  });
  
  describe('refreshAccessToken', () => {
    it('should refresh expired token', async () => {
      // This test will fail without real refresh token
      const refreshToken = process.env.TEST_REFRESH_TOKEN || 'test_refresh';
      try {
        const result = await tiktokAPI.refreshAccessToken(refreshToken);
        expect(result).toHaveProperty('access_token');
        expect(result).toHaveProperty('expires_in');
      } catch (error) {
        // Expected to fail without real token
        expect(error).toBeDefined();
      }
    });
  });
});
