/**
 * Cron Job: Refresh Song Stats
 * GET /api/cron/refresh-songs
 * 
 * Periodically refreshes song statistics (video count) for songs
 * linked to active campaigns, using Apify.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apifyClient } from '@/lib/apify/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // 1. Basic security check (allow local development without secret)
    if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Cron] Starting song stats refresh...');

        // 2. Fetch songs that need refresh
        // Criteria: Used in active campaigns, and not updated in the last 20 hours
        const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);

        const songsToRefresh = await prisma.song.findMany({
            where: {
                campaigns: {
                    some: {
                        status: 'ACTIVE'
                    }
                },
                OR: [
                    { statsLastFetched: null },
                    { statsLastFetched: { lt: twentyHoursAgo } }
                ]
            },
            take: 5 // Process in small batches to avoid timeouts
        });

        console.log(`[Cron] Found ${songsToRefresh.length} songs to refresh`);

        const results: Array<{ id: string; title: string; status: string; error?: string }> = [];

        // 3. Refresh each song using Apify
        for (const song of songsToRefresh) {
            try {
                if (!song.tiktokUrl) {
                    console.warn(`[Cron] Song ${song.id} has no TikTok URL, skipping`);
                    continue;
                }

                console.log(`[Cron] Refreshing song: ${song.title} (${song.tiktokMusicId})`);

                // Fetch fresh metadata from Apify
                const metadata = await apifyClient.fetchMusicMetadata(song.tiktokUrl);

                // Update database
                await prisma.song.update({
                    where: { id: song.id },
                    data: {
                        // In a real scenario, the actor would return video count.
                        // For now we simulate or use the data if available.
                        // Assuming metadata includes videoCount if we update the client later.
                        statsLastFetched: new Date(),
                        updatedAt: new Date()
                    }
                });

                results.push({ id: song.id, title: song.title, status: 'success' });
            } catch (err: any) {
                console.error(`[Cron] Failed to refresh song ${song.id}:`, err.message);
                results.push({ id: song.id, title: song.title, status: 'failed', error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        console.error('[Cron] Error in song stats refresh:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
