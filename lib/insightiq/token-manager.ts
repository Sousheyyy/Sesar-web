/**
 * Token Manager
 * Handles automatic token refresh for InsightIQ access tokens
 */

import { prisma } from '@/lib/prisma';
import { insightIQClient } from './client';
import { encryptToken, decryptToken } from '@/lib/crypto';

/**
 * Get a valid access token for a user
 * Automatically refreshes if expired or expiring soon
 */
export async function getValidAccessToken(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            insightiqAccessToken: true,
            insightiqRefreshToken: true,
            insightiqTokenExpiry: true,
        },
    });

    if (!user?.insightiqAccessToken || !user?.insightiqRefreshToken) {
        throw new Error(
            'User has not connected their TikTok account via InsightIQ. ' +
            'Please complete OAuth flow first.'
        );
    }

    const now = new Date();
    const expiry = user.insightiqTokenExpiry;

    // If token expires in less than 5 minutes, refresh it
    const shouldRefresh =
        !expiry || expiry.getTime() - now.getTime() < 5 * 60 * 1000;

    if (shouldRefresh) {
        console.log(`Refreshing access token for user ${userId}`);

        const refreshToken = decryptToken(user.insightiqRefreshToken);
        const newTokens = await insightIQClient.refreshToken(refreshToken);

        const newExpiry = new Date();
        newExpiry.setSeconds(newExpiry.getSeconds() + newTokens.expires_in);

        // Update tokens in database
        await prisma.user.update({
            where: { id: userId },
            data: {
                insightiqAccessToken: encryptToken(newTokens.access_token),
                insightiqRefreshToken: encryptToken(newTokens.refresh_token),
                insightiqTokenExpiry: newExpiry,
            },
        });

        return newTokens.access_token;
    }

    // Token is still valid, decrypt and return
    return decryptToken(user.insightiqAccessToken);
}

/**
 * Check if a user has connected their TikTok account
 */
export async function isUserConnected(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            insightiqAccessToken: true,
            tiktokUserId: true,
        },
    });

    return !!(user?.insightiqAccessToken && user?.tiktokUserId);
}

/**
 * Disconnect user's TikTok account
 * Removes all InsightIQ tokens
 */
export async function disconnectTikTok(userId: string): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: {
            insightiqAccessToken: null,
            insightiqRefreshToken: null,
            insightiqTokenExpiry: null,
            tiktokUserId: null,
            tiktokUsername: null,
            tiktokDisplayName: null,
            tiktokAvatarUrl: null,
            tiktokConnectedAt: null,
        },
    });
}

/**
 * Get user's TikTok connection status
 */
export async function getTikTokConnectionStatus(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            tiktokUserId: true,
            tiktokUsername: true,
            tiktokDisplayName: true,
            tiktokAvatarUrl: true,
            tiktokConnectedAt: true,
            insightiqTokenExpiry: true,
        },
    });

    if (!user?.tiktokUserId) {
        return {
            connected: false,
            user: null,
        };
    }

    const now = new Date();
    const expiresIn = user.insightiqTokenExpiry
        ? Math.floor((user.insightiqTokenExpiry.getTime() - now.getTime()) / 1000)
        : 0;

    return {
        connected: true,
        user: {
            userId: user.tiktokUserId,
            username: user.tiktokUsername,
            displayName: user.tiktokDisplayName,
            avatarUrl: user.tiktokAvatarUrl,
            connectedAt: user.tiktokConnectedAt,
            tokenExpiresIn: expiresIn,
        },
    };
}
