/**
 * InsightIQ/Phyllo - Process Connection Results
 * POST /api/auth/insightiq/process-connection
 * 
 * Called by the frontend after Phyllo SDK redirect flow completes.
 * Processes the connected accounts and updates the user record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { insightIQClient } from '@/lib/insightiq/client';

// Cache for TikTok platform ID
let cachedTikTokPlatformId: string | null = null;

export async function POST(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { userId: phylloUserId, accounts } = body;

        console.log('[InsightIQ] Processing connection results:', {
            ourUserId: session.user.id,
            phylloUserId,
            accounts,
        });

        if (!accounts || accounts.length === 0) {
            return NextResponse.json(
                { error: 'No accounts connected' },
                { status: 400 }
            );
        }

        // Get TikTok platform ID if not cached
        if (!cachedTikTokPlatformId) {
            cachedTikTokPlatformId = await insightIQClient.getTikTokPlatformId();
        }

        // Find TikTok account from connected accounts
        // Match by platform ID or by checking if name contains "tiktok"
        const tiktokAccount = accounts.find(
            (acc: { account_id: string; work_platform_id: string }) =>
                acc.work_platform_id === cachedTikTokPlatformId ||
                acc.work_platform_id?.toLowerCase().includes('tiktok')
        );

        if (!tiktokAccount) {
            return NextResponse.json(
                { error: 'No TikTok account found' },
                { status: 400 }
            );
        }

        console.log('[InsightIQ] TikTok account connected:', tiktokAccount.account_id);

        // Try to fetch account details from InsightIQ
        let accountDetails: any = null;
        try {
            accountDetails = await insightIQClient.getAccount(tiktokAccount.account_id);
            console.log('[InsightIQ] Account details:', accountDetails);
        } catch (error) {
            console.error('[InsightIQ] Failed to fetch account details:', error);
            // Continue anyway - we can update details later via webhook
        }

        // Update user with TikTok connection info
        const updateData: any = {
            tiktokUserId: tiktokAccount.account_id,
            tiktokConnectedAt: new Date(),
        };

        // Add account details if available
        if (accountDetails) {
            if (accountDetails.username) {
                updateData.tiktokUsername = accountDetails.username;
                updateData.tiktokHandle = accountDetails.username;
            }
            if (accountDetails.platform_profile_name) {
                updateData.tiktokDisplayName = accountDetails.platform_profile_name;
            }
            if (accountDetails.platform_profile_picture_url) {
                updateData.tiktokAvatarUrl = accountDetails.platform_profile_picture_url;
            }
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
        });

        console.log('[InsightIQ] User updated with TikTok connection');

        return NextResponse.json({
            success: true,
            message: 'TikTok connection processed',
            accountId: tiktokAccount.account_id,
        });
    } catch (error) {
        console.error('[InsightIQ] Process connection error:', error);

        return NextResponse.json(
            {
                error: 'Failed to process connection',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
