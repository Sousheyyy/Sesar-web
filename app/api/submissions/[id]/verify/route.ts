import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tiktokMetadata } from "@/lib/tiktok-metadata";
import { UserRole } from "@prisma/client";
import { updateEstimatedPayouts } from "@/lib/payout";
import { extractTikTokUsernameFromUrl } from "@/lib/url-utils";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins and artists (for their own campaigns) can verify submissions
    const submission = await prisma.submission.findUnique({
      where: { id: params.id },
      include: {
        campaign: {
          include: {
            song: true,
          },
        },
        creator: {
          select: {
            id: true,
            tiktokHandle: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (
      session.user.role !== UserRole.ADMIN &&
      submission.campaign.artistId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Unauthorized to verify this submission" },
        { status: 403 }
      );
    }

    // Extract TikTok video metadata
    let videoMetadata;
    try {
      videoMetadata = await tiktokMetadata.getVideoMetadata(submission.tiktokUrl);
    } catch (scrapeError: any) {
      // Handle TikAPI specific errors
      if (scrapeError.message?.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      if (scrapeError.message?.includes("private") || scrapeError.message?.includes("not found")) {
        await prisma.submission.update({
          where: { id: params.id },
          data: {
            status: "REJECTED",
            rejectionReason: "Video özel, silinmiş veya erişilebilir değil",
            verified: false,
          },
        });
        return NextResponse.json({
          success: false,
          message: "Video reddedildi: Erişilebilir değil",
        });
      }
      // Re-throw other errors
      throw scrapeError;
    }

    // VERIFICATION: Verify video ownership (video belongs to creator's connected TikTok account)
    if (!submission.creator.tiktokHandle || submission.creator.tiktokHandle.trim() === "") {
      await prisma.submission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          rejectionReason: "İçerik üreticisi TikTok profilini bağlamamış",
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Video reddedildi: İçerik üreticisi TikTok profilini bağlamamış",
      });
    }

    const normalizeUsername = (username: string) => {
      return username.replace(/^@/, "").toLowerCase().trim();
    };

    const creatorHandle = normalizeUsername(submission.creator.tiktokHandle);
    const videoCreatorUsername = normalizeUsername(videoMetadata.author);

    if (videoCreatorUsername !== creatorHandle) {
      await prisma.submission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          rejectionReason: `Bu video içerik üreticisinin bağlı TikTok hesabına (@${submission.creator.tiktokHandle}) ait değil`,
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Video reddedildi: Video içerik üreticisinin TikTok hesabına ait değil",
      });
    }

    // Verify song (EXACT MATCH ONLY)
    const songMatch = tiktokMetadata.validateSongMatch(
      {
        id: submission.campaign.song.tiktokMusicId!,
        title: submission.campaign.song.title,
        authorName: submission.campaign.song.authorName!
      },
      videoMetadata.song
    );

    if (!songMatch.match) {
      await prisma.submission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          rejectionReason: `Video doğru şarkıyı kullanmıyor: ${songMatch.reason}`,
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: `Video reddedildi: ${songMatch.reason}`,
      });
    }

    // Check duration requirement
    if (
      submission.campaign.minVideoDuration &&
      videoData.duration < submission.campaign.minVideoDuration
    ) {
      await prisma.submission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          rejectionReason: `Video süresi (${videoData.duration}sn) gereken süreden (${submission.campaign.minVideoDuration}sn) kısa`,
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Video reddedildi: Süre çok kısa",
      });
    }

    // NOTE: Follower requirement check removed - use OAuth data instead
    // The follower count is now updated via official TikTok OAuth

    // All checks passed - update submission with video data and approve
    await prisma.submission.update({
      where: { id: params.id },
      data: {
        tiktokVideoId: videoMetadata.id,
        lastViewCount: videoMetadata.stats.views,
        lastLikeCount: videoMetadata.stats.likes,
        lastCommentCount: videoMetadata.stats.comments,
        lastShareCount: videoMetadata.stats.shares,
        videoDuration: videoMetadata.duration,
        verified: true,
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
        status: "APPROVED",
      },
    });

    // Update estimated payouts for all participants
    await updateEstimatedPayouts(submission.campaignId);

    // Notify creator
    await prisma.notification.create({
      data: {
        userId: submission.creatorId,
        title: "Submission Approved!",
        message: `Your submission for "${submission.campaign.title}" has been approved. You have joined the prize pool!`,
        link: `/dashboard/submissions`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Submission approved and added to prize pool",
      videoData: videoMetadata,
    });
  } catch (error: any) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify submission" },
      { status: 500 }
    );
  }
}


