/**
 * InsightIQ/Phyllo - Initiate TikTok Connection
 * POST /api/auth/insightiq/initiate
 * 
 * Uses the SDK REDIRECT FLOW:
 * 1. Get or create user in InsightIQ/Phyllo
 * 2. Create SDK token
 * 3. Fetch TikTok platform ID dynamically
 * 4. Return token and config for frontend SDK initialization with redirect flow
 * 5. Frontend SDK handles redirect to Phyllo and back
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { insightIQClient } from '@/lib/insightiq/client';

// Cache for TikTok platform ID (fetched dynamically from API)
let cachedTikTokPlatformId: string | null = null;

export async function POST(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized - Please login first' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const userName = session.user.name || session.user.email || userId;

        console.log(`[InsightIQ] Initiating connection for user: ${userId}`);

        // Step 1: Get or create user in InsightIQ/Phyllo
        console.log('[InsightIQ] Step 1: Getting/creating InsightIQ user...');
        const insightiqUser = await insightIQClient.getOrCreateUser(userId, userName);

        // Step 2: Create SDK token
        // Note: redirect URL is handled by frontend SDK config, not here
        console.log('[InsightIQ] Step 2: Creating SDK token...');

        const result = await insightIQClient.createSdkToken(
            insightiqUser.id,
            ['IDENTITY', 'ENGAGEMENT']
        );

        console.log(`[InsightIQ] SDK token created successfully`);
        console.log('[InsightIQ] SDK Token ID:', result.sdk_token_id);

        // Determine environment
        const environment = process.env.INSIGHTIQ_BASE_URL?.includes('sandbox')
            ? 'sandbox'
            : process.env.INSIGHTIQ_BASE_URL?.includes('staging')
            ? 'staging'
            : 'production';

        // Step 3: Get TikTok platform ID (cached after first fetch)
        if (!cachedTikTokPlatformId) {
            console.log('[InsightIQ] Step 3: Fetching TikTok platform ID...');
            cachedTikTokPlatformId = await insightIQClient.getTikTokPlatformId();
            console.log('[InsightIQ] TikTok platform ID:', cachedTikTokPlatformId);
        }

        return NextResponse.json({
            success: true,
            // SDK configuration for frontend
            token: result.sdk_token,
            userId: insightiqUser.id, // Phyllo user ID (not our internal ID)
            environment,
            workPlatformId: cachedTikTokPlatformId, // Skip platform selection (null = show all)
            // Additional info
            sdkTokenId: result.sdk_token_id,
            expiresAt: result.expires_at,
        });
    } catch (error) {
        console.error('[InsightIQ] Error:', error);

        return NextResponse.json(
            {
                error: 'Failed to initiate TikTok connection',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
