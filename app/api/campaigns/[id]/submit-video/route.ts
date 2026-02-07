/**
 * Video Submission (Simplified - InsightIQ Integration Removed)
 * POST /api/campaigns/[id]/submit-video
 *
 * Creator submits video URL for manual verification
 * Auto-verification has been disabled - now using Apify for data fetching
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { videoUrl } = await req.json();

        if (!videoUrl || !videoUrl.includes('tiktok.com')) {
            return NextResponse.json(
                { error: 'Invalid TikTok video URL' },
                { status: 400 }
            );
        }

        console.log(`[Video Submit] Campaign: ${params.id}, URL: ${videoUrl}`);

        // Get campaign
        const campaign = await prisma.campaign.findUnique({
            where: { id: params.id },
            include: { song: true },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        if (campaign.status !== 'ACTIVE') {
            return NextResponse.json(
                { error: 'Campaign is not active' },
                { status: 400 }
            );
        }

        // Check if user already submitted to this campaign
        const existingSubmission = await prisma.submission.findUnique({
            where: {
                campaignId_creatorId: {
                    campaignId: params.id,
                    creatorId: session.user.id,
                },
            },
        });

        if (existingSubmission) {
            return NextResponse.json(
                {
                    error: 'Already submitted',
                    message: 'You have already submitted a video to this campaign',
                    submission: existingSubmission,
                },
                { status: 409 }
            );
        }

        // Get user's follower count
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { followerCount: true },
        });

        // Create submission (will be verified manually or by admin)
        const submission = await prisma.submission.create({
            data: {
                campaignId: campaign.id,
                creatorId: session.user.id,
                tiktokUrl: videoUrl,
                verified: false, // Requires manual verification
                status: 'PENDING', // Admin must approve
                creatorFollowers: user?.followerCount || 0,
                lastCheckedAt: new Date(),
            },
        });

        console.log(`[Video Submit] Submission created: ${submission.id} (pending verification)`);

        return NextResponse.json({
            success: true,
            submission,
            message: 'Video submitted successfully! Waiting for verification.',
            note: 'Your submission will be verified by the campaign artist or admin.',
        });
    } catch (error) {
        console.error('[Video Submit] Error:', error);

        return NextResponse.json(
            {
                error: 'Failed to submit video',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
