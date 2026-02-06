/**
 * InsightIQ OAuth - Callback Handler
 * GET /api/auth/insightiq/callback
 * 
 * Handles OAuth callback after user authorizes TikTok
 * 
 * Note: This callback is typically invoked after redirecting from OAuth.
 * It uses a state parameter or cookies to identify the user who initiated the flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { insightIQClient } from '@/lib/insightiq/client';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userToken = searchParams.get('user_token');
        const status = searchParams.get('status');
        const platform = searchParams.get('platform');
        const stateParam = searchParams.get('state'); // Optional state from OAuth flow

        console.log(`[InsightIQ] Callback received - Status: ${status}, Platform: ${platform}`);

        // Check if OAuth was successful
        if (status !== 'success' || !userToken) {
            console.error('[InsightIQ] OAuth failed or cancelled');
            return NextResponse.redirect(
                new URL('/settings?error=tiktok_connection_failed', req.url)
            );
        }

        if (platform !== 'tiktok') {
            console.error('[InsightIQ] Unexpected platform:', platform);
            return NextResponse.redirect(
                new URL('/settings?error=invalid_platform', req.url)
            );
        }

        console.log('[InsightIQ] Exchanging user_token for access_token...');

        // Exchange user_token for access_token and refresh_token
        const tokenData = await insightIQClient.exchangeToken(userToken);

        console.log(`[InsightIQ] Token exchange successful for TikTok user: ${tokenData.platform_username}`);

        // Get user's TikTok profile information
        const identity = await insightIQClient.getUserIdentity(tokenData.access_token);

        console.log(`[InsightIQ] Identity fetched - Username: ${identity.username}`);

        // Calculate token expiry
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + tokenData.expires_in);

        // TikTok connection data
        const tiktokData = {
            insightiqAccessToken: encryptToken(tokenData.access_token),
            insightiqRefreshToken: encryptToken(tokenData.refresh_token),
            insightiqTokenExpiry: expiryDate,
            tiktokUserId: identity.platform_user_id,
            tiktokUsername: identity.username,
            tiktokDisplayName: identity.display_name,
            tiktokAvatarUrl: identity.avatar_url,
            tiktokConnectedAt: new Date(),
            tiktokHandle: identity.username,
            followerCount: identity.follower_count,
            followingCount: identity.following_count,
            totalLikes: identity.likes_count,
            videoCount: identity.video_count,
            lastStatsFetchedAt: new Date(),
        };

        // Try to get the current user from state parameter (user_id passed during initiate)
        // InsightIQ passes back our user_id in the state or we stored it in a cookie
        let userId = stateParam;

        // Check if a user already exists with this TikTok ID (reconnecting)
        const existingTikTokUser = await prisma.user.findUnique({
            where: { tiktokUserId: identity.platform_user_id },
            select: { id: true },
        });

        if (existingTikTokUser) {
            // User is reconnecting their TikTok - update their tokens
            console.log(`[InsightIQ] Reconnecting TikTok for existing user: ${existingTikTokUser.id}`);
            await prisma.user.update({
                where: { id: existingTikTokUser.id },
                data: tiktokData,
            });
            userId = existingTikTokUser.id;
        } else if (userId) {
            // We have a user_id from the state - link TikTok to this user
            console.log(`[InsightIQ] Linking TikTok to user: ${userId}`);

            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, tiktokUserId: true },
            });

            if (existingUser) {
                if (existingUser.tiktokUserId && existingUser.tiktokUserId !== identity.platform_user_id) {
                    // User already has a different TikTok linked
                    console.warn('[InsightIQ] User already has a different TikTok account linked');
                    return NextResponse.redirect(
                        new URL('/settings?error=tiktok_already_linked', req.url)
                    );
                }

                await prisma.user.update({
                    where: { id: userId },
                    data: tiktokData,
                });
            } else {
                console.warn(`[InsightIQ] User not found: ${userId}`);
                // Fall through to create new user
                userId = null;
            }
        }

        // If we still don't have a user, create a new one
        if (!userId && !existingTikTokUser) {
            console.log('[InsightIQ] Creating new user from TikTok OAuth');
            const newUser = await prisma.user.create({
                data: {
                    email: `${identity.platform_user_id}@tiktok.temp`, // Temporary email
                    password: '', // No password for OAuth users
                    name: identity.display_name,
                    role: 'CREATOR', // Default to creator role
                    ...tiktokData,
                },
            });
            userId = newUser.id;
        }

        console.log(`[InsightIQ] User updated/created successfully: ${userId}`);

        // Redirect to settings page with success message
        return NextResponse.redirect(
            new URL('/settings?success=tiktok_connected', req.url)
        );
    } catch (error) {
        console.error('[InsightIQ] Error in OAuth callback:', error);

        return NextResponse.redirect(
            new URL(
                `/settings?error=token_exchange_failed&details=${encodeURIComponent(
                    error instanceof Error ? error.message : 'Unknown error'
                )}`,
                req.url
            )
        );
    }
}
