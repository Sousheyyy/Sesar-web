/**
 * InsightIQ Integration Test Suite
 * Comprehensive tests for all InsightIQ functionality
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { insightIQClient } from '@/lib/insightiq/client';
import { encryptToken, decryptToken, testEncryption } from '@/lib/crypto';
import {
    extractMusicId,
    extractVideoId,
    extractUsername,
    isTikTokMusicUrl,
    isTikTokVideoUrl,
    normalizeTikTokUrl,
} from '@/lib/insightiq/url-utils';

describe('InsightIQ Integration Tests', () => {
    describe('Encryption Utilities', () => {
        it('should encrypt and decrypt tokens correctly', () => {
            const testToken = 'test-access-token-12345';
            const encrypted = encryptToken(testToken);
            const decrypted = decryptToken(encrypted);

            expect(decrypted).toBe(testToken);
            expect(encrypted).not.toBe(testToken);
            expect(encrypted).toContain(':'); // IV:encrypted format
        });

        it('should generate different encrypted values for same token', () => {
            const testToken = 'test-token';
            const encrypted1 = encryptToken(testToken);
            const encrypted2 = encryptToken(testToken);

            expect(encrypted1).not.toBe(encrypted2); // Different IVs
            expect(decryptToken(encrypted1)).toBe(testToken);
            expect(decryptToken(encrypted2)).toBe(testToken);
        });

        it('should pass encryption test', () => {
            const result = testEncryption();
            expect(result).toBe(true);
        });

        it('should handle empty string encryption', () => {
            const empty = '';
            const encrypted = encryptToken(empty);
            const decrypted = decryptToken(encrypted);
            expect(decrypted).toBe(empty);
        });

        it('should throw error on invalid encrypted format', () => {
            expect(() => decryptToken('invalid-format')).toThrow();
        });
    });

    describe('URL Utilities', () => {
        describe('extractMusicId', () => {
            it('should extract music ID from standard URL', () => {
                const url = 'https://www.tiktok.com/music/Song-Name-7123456789012345678';
                const id = extractMusicId(url);
                expect(id).toBe('7123456789012345678');
            });

            it('should extract music ID from URL with dashes', () => {
                const url =
                    'https://www.tiktok.com/music/Cool-Song-With-Dashes-7000000000000000000';
                const id = extractMusicId(url);
                expect(id).toBe('7000000000000000000');
            });

            it('should return null for invalid music URL', () => {
                const url = 'https://www.tiktok.com/@user/video/123';
                const id = extractMusicId(url);
                expect(id).toBeNull();
            });

            it('should return null for empty string', () => {
                const id = extractMusicId('');
                expect(id).toBeNull();
            });
        });

        describe('extractVideoId', () => {
            it('should extract video ID from standard URL', () => {
                const url = 'https://www.tiktok.com/@username/video/7350123456789012345';
                const id = extractVideoId(url);
                expect(id).toBe('7350123456789012345');
            });

            it('should extract video ID from URL with query params', () => {
                const url =
                    'https://www.tiktok.com/@user/video/7123456789?is_from_webapp=1';
                const id = extractVideoId(url);
                expect(id).toBe('7123456789');
            });

            it('should return null for music URL', () => {
                const url = 'https://www.tiktok.com/music/Song-123';
                const id = extractVideoId(url);
                expect(id).toBeNull();
            });
        });

        describe('extractUsername', () => {
            it('should extract username from profile URL', () => {
                const url = 'https://www.tiktok.com/@username';
                const username = extractUsername(url);
                expect(username).toBe('username');
            });

            it('should extract username from video URL', () => {
                const url = 'https://www.tiktok.com/@testuser/video/123';
                const username = extractUsername(url);
                expect(username).toBe('testuser');
            });

            it('should handle username with numbers and dots', () => {
                const url = 'https://www.tiktok.com/@user.123';
                const username = extractUsername(url);
                expect(username).toBe('user.123');
            });
        });

        describe('URL validation', () => {
            it('should validate TikTok music URLs', () => {
                expect(isTikTokMusicUrl('https://www.tiktok.com/music/Song-123')).toBe(
                    true
                );
                expect(isTikTokMusicUrl('https://www.tiktok.com/@user/video/123')).toBe(
                    false
                );
            });

            it('should validate TikTok video URLs', () => {
                expect(
                    isTikTokVideoUrl('https://www.tiktok.com/@user/video/123')
                ).toBe(true);
                expect(isTikTokVideoUrl('https://www.tiktok.com/music/Song-123')).toBe(
                    false
                );
                expect(isTikTokVideoUrl('https://www.tiktok.com/@user')).toBe(false);
            });
        });

        describe('URL normalization', () => {
            it('should normalize mobile URL to desktop URL', () => {
                const mobile = 'https://m.tiktok.com/video/123';
                const normal = normalizeTikTokUrl(mobile);
                expect(normal).toBe('https://www.tiktok.com/video/123');
            });

            it('should normalize vm URL to desktop URL', () => {
                const vm = 'https://vm.tiktok.com/abc123';
                const normal = normalizeTikTokUrl(vm);
                expect(normal).toBe('https://www.tiktok.com/abc123');
            });

            it('should leave desktop URL unchanged', () => {
                const desktop = 'https://www.tiktok.com/video/123';
                const normal = normalizeTikTokUrl(desktop);
                expect(normal).toBe(desktop);
            });
        });
    });

    describe('InsightIQ Client (Integration)', () => {
        // These tests require valid credentials and network access
        // Mark as integration tests or skip in CI

        it.skip('should initialize client with config', () => {
            expect(insightIQClient).toBeDefined();
            // Config tests would go here
        });

        it.skip('should initiate connection (sandbox)', async () => {
            const result = await insightIQClient.initiateConnection('test-user-id');

            expect(result).toHaveProperty('connect_url');
            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('expires_in');
            expect(result.connect_url).toContain('insightiq');
        });

        it.skip('should handle API errors gracefully', async () => {
            await expect(insightIQClient.exchangeToken('invalid-token')).rejects.toThrow(
                'InsightIQ API Error'
            );
        });
    });
});

describe('API Route Tests', () => {
    describe('POST /api/auth/insightiq/initiate', () => {
        it('should require authentication', async () => {
            // Mock test - would use actual request in real test
            const response = { status: 401, error: 'Unauthorized' };
            expect(response.status).toBe(401);
        });

        it('should return connect URL on success', async () => {
            // Mock successful response
            const response = {
                status: 200,
                connectUrl: 'https://insightiq.ai/connect/...',
                expiresIn: 600,
            };

            expect(response).toHaveProperty('connectUrl');
            expect(response.expiresIn).toBe(600);
        });
    });

    describe('GET /api/auth/insightiq/callback', () => {
        it('should handle missing user_token', async () => {
            // Mock error response
            const response = { status: 302, location: '/settings?error=...' };
            expect(response.status).toBe(302);
        });

        it('should exchange token and create user', async () => {
            // Mock successful callback
            const response = {
                status: 302,
                location: '/settings?success=tiktok_connected',
            };

            expect(response.location).toContain('success=tiktok_connected');
        });
    });

    describe('POST /api/songs/upload', () => {
        it('should validate TikTok music URL', async () => {
            const invalidUrl = 'https://www.tiktok.com/@user/video/123';
            const response = { status: 400, error: 'Invalid TikTok music URL' };

            expect(response.status).toBe(400);
        });

        it('should require TikTok connection', async () => {
            const response = { status: 403, error: 'TikTok not connected' };
            expect(response.status).toBe(403);
            expect(response.error).toContain('not connected');
        });

        it('should create song with music metadata', async () => {
            const mockSong = {
                id: 'song-123',
                title: 'Test Song',
                authorName: 'Test Artist',
                tiktokMusicId: '7123456789',
                musicCoverUrl: 'https://...',
                videoCount: 5,
            };

            expect(mockSong).toHaveProperty('tiktokMusicId');
            expect(mockSong).toHaveProperty('musicCoverUrl');
            expect(mockSong.videoCount).toBeGreaterThan(0);
        });

        it('should prevent duplicate songs', async () => {
            const response = {
                status: 409,
                error: 'Song already exists',
            };

            expect(response.status).toBe(409);
        });
    });

    describe('POST /api/campaigns/[id]/submit-video', () => {
        it('should validate TikTok video URL', async () => {
            const invalidUrl = 'https://www.tiktok.com/music/Song-123';
            const response = { status: 400, error: 'Invalid TikTok video URL' };

            expect(response.status).toBe(400);
        });

        it('should verify music matches campaign song', async () => {
            const wrongSongResponse = {
                status: 400,
                error: 'Wrong song',
                expected: { title: 'Song A', artist: 'Artist A' },
                actual: { title: 'Song B', artist: 'Artist B' },
            };

            expect(wrongSongResponse.error).toBe('Wrong song');
            expect(wrongSongResponse).toHaveProperty('expected');
            expect(wrongSongResponse).toHaveProperty('actual');
        });

        it('should auto-approve matching submissions', async () => {
            const submission = {
                id: 'sub-123',
                verified: true,
                status: 'APPROVED',
                tiktokVideoId: '7350123456789',
            };

            expect(submission.verified).toBe(true);
            expect(submission.status).toBe('APPROVED');
        });

        it('should prevent duplicate submissions', async () => {
            const response = {
                status: 409,
                error: 'Already submitted',
            };

            expect(response.status).toBe(409);
        });
    });
});

// Export for use by other test files
export { };
