/**
 * Check if a user exists by TikTok handle
 * GET /api/user/by-tiktok?handle=username
 *
 * Used by mobile app to check if a TikTok user is already registered
 * before creating a new account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const handle = searchParams.get('handle');

        if (!handle) {
            return NextResponse.json(
                { error: 'handle is required' },
                { status: 400 }
            );
        }

        // Clean the handle (remove @ if present)
        const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

        // Check if user exists with this TikTok handle
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { tiktokHandle: cleanHandle },
                    { tiktokHandle: `@${cleanHandle}` },
                    { tiktokUsername: cleanHandle },
                ]
            },
            select: {
                id: true,
                name: true,
                tiktokHandle: true,
            }
        });

        if (user) {
            return NextResponse.json({
                exists: true,
                userId: user.id,
                name: user.name,
                tiktokHandle: user.tiktokHandle,
            });
        }

        return NextResponse.json({
            exists: false,
        });
    } catch (error) {
        console.error('[User by TikTok] Error:', error);

        return NextResponse.json(
            {
                error: 'Failed to check user',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
