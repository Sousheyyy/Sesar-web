/**
 * Video Submission with InsightIQ Verification
 * POST /api/campaigns/[id]/submit-video
 * 
 * Creator submits video and system verifies correct song is used
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { insightIQClient } from '@/lib/insightiq/client';
import { getValidAccessToken } from '@/lib/insightiq/token-manager';
import {
    extractVideoId,
    isTikTokVideoUrl,
    normalizeTikTokUrl,
} from '@/lib/insightiq/url-utils';

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

        if (!videoUrl) {
            return NextResponse.json(
                { error: 'Video URL is required' },
                { status: 400 }
            );
        }

        // Normalize URL
        const normalizedUrl = normalizeTikTokUrl(videoUrl);

        // Validate URL is a TikTok video URL
        if (!isTikTokVideoUrl(normalizedUrl)) {
            return NextResponse.json(
                {
                    error: 'Invalid TikTok video URL',
                    message: 'Please provide a valid TikTok video URL',
                },
                { status: 400 }
            );
        }

        // Extract video ID
        const videoId = extractVideoId(normalizedUrl);

        if (!videoId) {
            return NextResponse.json(
                {
                    error: 'Could not extract video ID from URL',
                    message: 'Please check the URL format',
                },
                { status: 400 }
            );
        }

        console.log(`[Video Submit] Campaign: ${params.id}, Video ID: ${videoId}`);

        // Get campaign with song
        const campaign = await prisma.campaign.findUnique({
            where: { id: params.id },
            include: { song: true },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
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

        // Get user's valid access token
        const accessToken = await getValidAccessToken(session.user.id);

        console.log('[Video Submit] Fetching user videos from InsightIQ...');

        // Fetch user's videos to find the submitted one
        const contents = await insightIQClient.getUserContents(accessToken, {
            limit: 100,
        });

        // Find the submitted video
        const video = contents.data.find((v) => v.platform_content_id === videoId);

        if (!video) {
            return NextResponse.json(
                {
                    error: 'Video not found',
                    message:
                        'Could not find this video in your TikTok account. ' +
                        'Make sure the video URL is correct and belongs to your account.',
                },
                { status: 404 }
            );
        }

        console.log('[Video Submit] Video found, verifying music...');

        // Check if video has music metadata
        if (!video.audio_track_info) {
            return NextResponse.json(
                {
                    error: 'No music detected',
                    message: 'This video does not contain any music track',
                },
                { status: 400 }
            );
        }

        // Verify the music matches the campaign song
        const musicMatches =
            video.audio_track_info.id === campaign.song.tiktokMusicId;

        if (!musicMatches) {
            console.log(
                `[Video Submit] Music mismatch - Expected: ${campaign.song.tiktokMusicId}, Got: ${video.audio_track_info.id}`
            );

            return NextResponse.json(
                {
                    error: 'Wrong song',
                    message: `This video uses "${video.audio_track_info.title}" by ${video.audio_track_info.artist}, but the campaign requires "${campaign.song.title}" by ${campaign.song.authorName}`,
                    expected: {
                        title: campaign.song.title,
                        artist: campaign.song.authorName,
                    },
                    actual: {
                        title: video.audio_track_info.title,
                        artist: video.audio_track_info.artist,
                    },
                },
                { status: 400 }
            );
        }

        console.log('[Video Submit] Music verified! Creating submission...');

        // Get user's follower count
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { followerCount: true },
        });

        // Create submission
        const submission = await prisma.submission.create({
            data: {
                campaignId: campaign.id,
                creatorId: session.user.id,
                tiktokUrl: normalizedUrl,
                tiktokVideoId: videoId,
                verified: true, // Auto-verify since music matches
                verifiedAt: new Date(),
                status: 'APPROVED',
                lastViewCount: video.engagement.plays,
                lastLikeCount: video.engagement.likes,
                lastCommentCount: video.engagement.comments,
                lastShareCount: video.engagement.shares,
                creatorFollowers: user?.followerCount || 0,
                videoDuration: video.duration || 0,
                lastCheckedAt: new Date(),
            },
        });

        console.log(`[Video Submit] Submission created: ${submission.id}`);

        return NextResponse.json({
            success: true,
            submission,
            video: {
                title: video.title,
                thumbnail: video.thumbnail_url,
                engagement: video.engagement,
            },
            message: 'Video submitted and verified successfully!',
        });
    } catch (error) {
        console.error('[Video Submit] Error:', error);

        if (error instanceof Error) {
            if (error.message.includes('not connected')) {
                return NextResponse.json(
                    {
                        error: 'TikTok not connected',
                        message: 'Please connect your TikTok account first',
                        requiresConnection: true,
                    },
                    { status: 403 }
                );
            }

            if (error.message.includes('InsightIQ API Error')) {
                return NextResponse.json(
                    {
                        error: 'API Error',
                        message: error.message,
                    },
                    { status: 502 }
                );
            }
        }

        return NextResponse.json(
            {
                error: 'Failed to submit video',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
