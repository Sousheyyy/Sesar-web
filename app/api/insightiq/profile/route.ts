/**
 * InsightIQ Profile - Get TikTok profile from account ID
 * GET /api/insightiq/profile?accountId=xxx
 *
 * Fetches TikTok profile information after successful InsightIQ connection.
 * Used by mobile app to get TikTok handle for signup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { insightIQClient } from '@/lib/insightiq/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get('accountId');

        if (!accountId) {
            return NextResponse.json(
                { error: 'accountId is required' },
                { status: 400 }
            );
        }

        console.log('[InsightIQ Profile] Fetching profile for account:', accountId);

        // Get account details from InsightIQ
        const account = await insightIQClient.getAccount(accountId);
        console.log('[InsightIQ Profile] Account data:', JSON.stringify(account, null, 2));

        // Try to get more profile info
        let profileData: any = null;
        try {
            profileData = await insightIQClient.getProfileByAccountId(accountId);
            console.log('[InsightIQ Profile] Profile data:', JSON.stringify(profileData, null, 2));
        } catch (e) {
            console.log('[InsightIQ Profile] Could not fetch extended profile:', e);
        }

        // Extract TikTok handle from account data
        const tiktokHandle = account.platform_username || account.username;
        const displayName = account.platform_profile_name || tiktokHandle;
        const profilePicture = account.platform_profile_picture_url;

        if (!tiktokHandle) {
            console.error('[InsightIQ Profile] No username found in account:', account);
            return NextResponse.json(
                { error: 'TikTok username not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            tiktokHandle,
            displayName,
            profilePicture,
            accountId: account.id,
            // Include raw data for debugging
            raw: {
                account,
                profile: profileData,
            },
        });
    } catch (error) {
        console.error('[InsightIQ Profile] Error:', error);

        return NextResponse.json(
            {
                error: 'Failed to fetch TikTok profile',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
