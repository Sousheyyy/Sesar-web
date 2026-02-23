import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apifyClient } from "@/lib/apify/client";
import { UserRole } from "@prisma/client";
import { updateEstimatedPayouts } from "@/lib/payout";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins and artists (for their own campaigns) can verify submissions
    const submission = await prisma.submission.findUnique({
      where: { id },
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

    // Fetch video metadata via Apify
    let videoData;
    try {
      const result = await apifyClient.fetchVideoData(submission.tiktokUrl);
      videoData = result.video;
    } catch (fetchError: any) {
      if (fetchError.message?.includes("rate limit") || fetchError.message?.includes("429")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      await prisma.submission.update({
        where: { id },
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

    // Check: Video is public
    if (videoData.isPrivate) {
      await prisma.submission.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: "Video herkese açık değil",
          verified: false,
        },
      });
      return NextResponse.json({
        success: false,
        message: "Video reddedildi: Video herkese açık değil",
      });
    }

    // VERIFICATION: Verify video ownership
    if (!submission.creator.tiktokHandle || submission.creator.tiktokHandle.trim() === "") {
      await prisma.submission.update({
        where: { id },
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
    if (!videoData.authorUniqueId || normalizeUsername(videoData.authorUniqueId) !== creatorHandle) {
      await prisma.submission.update({
        where: { id },
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

    // Verify song match (title or music ID match)
    let isSongMatch = false;
    if (videoData.music) {
      const trackTitle = (videoData.music.title || '').toLowerCase();
      const campaignSongTitle = (submission.campaign.song.title || '').toLowerCase();
      const titleMatch = trackTitle.includes(campaignSongTitle) || campaignSongTitle.includes(trackTitle);
      const idMatch = !!(submission.campaign.song.tiktokMusicId && videoData.music.id === submission.campaign.song.tiktokMusicId);
      isSongMatch = !!(titleMatch || idMatch);
    }

    if (!isSongMatch) {
      await prisma.submission.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: `Video doğru şarkıyı kullanmıyor: Kampanya şarkısı "${submission.campaign.song.title}" videoda bulunamadı.`,
          verified: false,
        },
      });
      return NextResponse.json({
        success: false,
        message: `Video reddedildi: Kampanya şarkısı "${submission.campaign.song.title}" videoda bulunamadı.`,
      });
    }

    // Check duration requirement
    if (
      submission.campaign.minVideoDuration &&
      videoData.duration < submission.campaign.minVideoDuration
    ) {
      await prisma.submission.update({
        where: { id },
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

    // All checks passed - update submission with video data and approve
    await prisma.submission.update({
      where: { id },
      data: {
        tiktokVideoId: videoData.videoId,
        lastViewCount: videoData.stats.playCount,
        lastLikeCount: videoData.stats.diggCount,
        lastCommentCount: videoData.stats.commentCount,
        lastShareCount: videoData.stats.shareCount,
        videoDuration: videoData.duration || null,
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
    });
  } catch (error: any) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify submission" },
      { status: 500 }
    );
  }
}
