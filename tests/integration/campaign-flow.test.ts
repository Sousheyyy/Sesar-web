import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { tiktokMetadata } from '@/lib/tiktok-metadata';

describe('Campaign Flow Integration', () => {
  let userId: string;
  let campaignId: string;
  
  // These tests require database connection and are skipped for basic implementation
  // Enable them when database is set up properly
  
  it.skip('should create campaign with valid song URL', async () => {
    const songUrl = 'https://www.tiktok.com/music/test-song-123';
    
    // Extract song metadata
    const songData = await tiktokMetadata.getSongMetadata(songUrl);
    
    // Create song
    const song = await prisma.song.create({
      data: {
        title: songData.title,
        authorName: songData.authorName,
        tiktokUrl: songUrl,
        tiktokMusicId: songData.id,
        artistId: userId
      }
    });
    
    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        title: 'Test Campaign',
        artistId: userId,
        songId: song.id,
        totalBudget: 20000,
        remainingBudget: 20000,
        status: 'ACTIVE',
        tier: 'C',
        durationDays: 7,
        commissionPercent: 20,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
    campaignId = campaign.id;
    expect(campaign).toBeDefined();
  });
  
  it.skip('should validate and accept matching video', async () => {
    const videoUrl = 'https://www.tiktok.com/@user/video/123';
    
    // Get campaign with song
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { song: true }
    });
    
    // Extract video metadata
    const videoData = await tiktokMetadata.getVideoMetadata(videoUrl);
    
    // Validate song match
    const match = tiktokMetadata.validateSongMatch(
      {
        id: campaign!.song.tiktokMusicId!,
        title: campaign!.song.title,
        authorName: campaign!.song.authorName!
      },
      videoData.song
    );
    
    expect(match.match).toBe(true);
  });
  
  it.skip('should reject video with wrong song', async () => {
    const wrongVideoUrl = 'https://www.tiktok.com/@user/video/456';
    
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { song: true }
    });
    
    const videoData = await tiktokMetadata.getVideoMetadata(wrongVideoUrl);
    
    const match = tiktokMetadata.validateSongMatch(
      {
        id: campaign!.song.tiktokMusicId!,
        title: campaign!.song.title,
        authorName: campaign!.song.authorName!
      },
      videoData.song
    );
    
    expect(match.match).toBe(false);
  });
});
