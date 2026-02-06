/**
 * TikTok Connection Status
 * GET /api/auth/insightiq/status
 * 
 * Check if user has connected their TikTok account
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTikTokConnectionStatus } from '@/lib/insightiq/token-manager';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const status = await getTikTokConnectionStatus(session.user.id);

        return NextResponse.json({
            success: true,
            ...status,
        });
    } catch (error) {
        console.error('[InsightIQ] Error getting connection status:', error);

        return NextResponse.json(
            {
                error: 'Failed to get connection status',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
