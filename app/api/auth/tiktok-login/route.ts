/**
 * TikTok Login - Handle login/signup for TikTok users
 * POST /api/auth/tiktok-login
 *
 * This endpoint:
 * 1. Checks if user exists with the given TikTok account ID
 * 2. If exists: returns user info for the app to use
 * 3. If new: creates user in database and returns user info
 *
 * The mobile app handles Supabase anonymous auth locally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            tiktokAccountId,
            tiktokHandle,
            displayName,
            profilePicture,
            supabaseUserId // The anonymous user ID from the mobile app
        } = body;

        if (!tiktokAccountId || !tiktokHandle) {
            return NextResponse.json(
                { error: 'tiktokAccountId and tiktokHandle are required' },
                { status: 400 }
            );
        }

        console.log('[TikTok Login] Processing login for:', { tiktokHandle, tiktokAccountId });

        // Check if user already exists with this TikTok account
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { tiktokUserId: tiktokAccountId },
                    { tiktokHandle: tiktokHandle },
                    { tiktokHandle: `@${tiktokHandle}` },
                    { tiktokUsername: tiktokHandle },
                ]
            },
            select: {
                id: true,
                name: true,
                email: true,
                tiktokHandle: true,
                tiktokUserId: true,
                avatar: true,
                role: true,
                creatorTier: true,
                balance: true,
            }
        });

        if (user) {
            console.log('[TikTok Login] Existing user found:', user.id);

            // Update TikTok account ID if not set
            if (!user.tiktokUserId && tiktokAccountId) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { tiktokUserId: tiktokAccountId }
                });
            }

            return NextResponse.json({
                success: true,
                isNewUser: false,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    tiktokHandle: user.tiktokHandle,
                    avatar: user.avatar,
                    role: user.role,
                    creatorTier: user.creatorTier,
                    balance: Number(user.balance) || 0,
                }
            });
        }

        // New user - create in database
        console.log('[TikTok Login] Creating new user for:', tiktokHandle);

        // Use Supabase user ID if provided, otherwise generate one
        const userId = supabaseUserId || randomUUID();
        const email = `user.${userId.substring(0, 8)}@sesar.app`;

        user = await prisma.user.create({
            data: {
                id: userId,
                email: email,
                password: 'supabase-auth',
                name: displayName || tiktokHandle,
                role: 'CREATOR',
                balance: 0,
                couponBalance: 0,
                plan: 'FREE',
                cycleStartDate: new Date(),
                tiktokHandle: tiktokHandle,
                tiktokUserId: tiktokAccountId,
                avatar: profilePicture,
            },
            select: {
                id: true,
                name: true,
                email: true,
                tiktokHandle: true,
                tiktokUserId: true,
                avatar: true,
                role: true,
                creatorTier: true,
                balance: true,
            }
        });

        console.log('[TikTok Login] New user created:', user.id);

        return NextResponse.json({
            success: true,
            isNewUser: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                tiktokHandle: user.tiktokHandle,
                avatar: user.avatar,
                role: user.role,
                creatorTier: user.creatorTier,
                balance: Number(user.balance) || 0,
            }
        });

    } catch (error) {
        console.error('[TikTok Login] Error:', error);

        // Handle unique constraint errors
        if (error instanceof Error && error.message.includes('Unique constraint')) {
            return NextResponse.json(
                { error: 'Bu TikTok hesabı zaten kayıtlı.' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                error: 'Login failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
