/**
 * Disconnect TikTok Account  
 * POST /api/auth/insightiq/disconnect
 * 
 * Remove TikTok connection from user account
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { disconnectTikTok } from '@/lib/insightiq/token-manager';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log(`[InsightIQ] Disconnecting TikTok for user: ${session.user.id}`);

        await disconnectTikTok(session.user.id);

        console.log('[InsightIQ] TikTok disconnected successfully');

        return NextResponse.json({
            success: true,
            message: 'TikTok account disconnected',
        });
    } catch (error) {
        console.error('[InsightIQ] Error disconnecting TikTok:', error);

        return NextResponse.json(
            {
                error: 'Failed to disconnect TikTok',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
