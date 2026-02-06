/**
 * InsightIQ Guest Token - For TikTok Signup (No Auth Required)
 * POST /api/insightiq/guest-token
 *
 * Creates a temporary user in InsightIQ and returns SDK token
 * for unauthenticated TikTok signup flow on mobile app.
 *
 * Flow:
 * 1. Generate temporary user ID
 * 2. Create InsightIQ user
 * 3. Create SDK token
 * 4. Return token for mobile app to open InsightIQ Connect
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { insightIQClient } from '@/lib/insightiq/client';

// TikTok platform ID (hardcoded fallback if API fetch fails)
const TIKTOK_PLATFORM_ID_FALLBACK = "9bb8913b-ddd9-430b-a66a-d74d846e6c66";

// Cache for TikTok platform ID
let cachedTikTokPlatformId: string | null = null;

export async function POST(_req: NextRequest) {
    try {
        console.log('[InsightIQ Guest] Creating guest token for TikTok signup...');

        // Step 1: Generate temporary user ID for guest
        const tempUserId = `guest_${randomUUID()}`;
        console.log('[InsightIQ Guest] Temp user ID:', tempUserId);

        // Step 2: Create user in InsightIQ
        console.log('[InsightIQ Guest] Creating InsightIQ user...');
        const insightiqUser = await insightIQClient.getOrCreateUser(tempUserId, 'Guest User');
        console.log('[InsightIQ Guest] InsightIQ user ID:', insightiqUser.id);

        // Step 3: Create SDK token
        console.log('[InsightIQ Guest] Creating SDK token...');
        const result = await insightIQClient.createSdkToken(
            insightiqUser.id,
            ['IDENTITY', 'ENGAGEMENT']
        );
        console.log('[InsightIQ Guest] SDK token created');

        // Step 4: Get TikTok platform ID (cached, with fallback)
        if (!cachedTikTokPlatformId) {
            console.log('[InsightIQ Guest] Fetching TikTok platform ID...');
            cachedTikTokPlatformId = await insightIQClient.getTikTokPlatformId();
            if (!cachedTikTokPlatformId) {
                console.log('[InsightIQ Guest] Using fallback TikTok platform ID');
                cachedTikTokPlatformId = TIKTOK_PLATFORM_ID_FALLBACK;
            }
        }

        // Determine environment
        const environment = process.env.INSIGHTIQ_BASE_URL?.includes('sandbox')
            ? 'sandbox'
            : process.env.INSIGHTIQ_BASE_URL?.includes('staging')
            ? 'staging'
            : 'production';

        return NextResponse.json({
            success: true,
            token: result.sdk_token,
            userId: insightiqUser.id,
            tempUserId, // Return temp ID for tracking
            environment,
            workPlatformId: cachedTikTokPlatformId,
            expiresAt: result.expires_at,
        });
    } catch (error) {
        console.error('[InsightIQ Guest] Error:', error);

        return NextResponse.json(
            {
                error: 'Failed to create guest token',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
