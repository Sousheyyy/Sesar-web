import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchVideoViaInsightIQ } from "@/lib/insightiq";
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

    // Fetch video metadata via InsightIQ
    let contentData: any;
    try {
      contentData = await fetchVideoViaInsightIQ(submission.tiktokUrl);
    } catch (fetchError: any) {
      // Handle specific errors
      if (fetchError.message?.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      if (fetchError.message?.includes("private") || fetchError.message?.includes("not found") || fetchError.message?.includes("herkese açık")) {
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
      throw fetchError;
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
    const videoUsername = contentData.profile?.platform_username?.toLowerCase() || contentData.creator?.platform_username?.toLowerCase() || "";

    if (!videoUsername || normalizeUsername(videoUsername) !== creatorHandle) {
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
    const audioTrack = contentData.audio_track_info || contentData.music;
    let isSongMatch = false;
    if (audioTrack) {
      const trackTitle = (audioTrack.title || audioTrack.name || '').toLowerCase();
      const campaignSongTitle = (submission.campaign.song.title || '').toLowerCase();
      const titleMatch = trackTitle.includes(campaignSongTitle) || campaignSongTitle.includes(trackTitle);
      const idMatch = !!(submission.campaign.song.tiktokMusicId && (audioTrack.platform_audio_id || audioTrack.id) === submission.campaign.song.tiktokMusicId);
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
    const videoDuration = contentData.duration || 0;
    if (
      submission.campaign.minVideoDuration &&
      videoDuration < submission.campaign.minVideoDuration
    ) {
      await prisma.submission.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: `Video süresi (${videoDuration}sn) gereken süreden (${submission.campaign.minVideoDuration}sn) kısa`,
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Video reddedildi: Süre çok kısa",
      });
    }

    // All checks passed - update submission with video data and approve
    const engagement = contentData.engagement || {};

    await prisma.submission.update({
      where: { id },
      data: {
        tiktokVideoId: contentData.platform_content_id || contentData.id,
        insightiqContentId: contentData.id,
        lastViewCount: engagement.view_count || 0,
        lastLikeCount: engagement.like_count || 0,
        lastCommentCount: engagement.comment_count || 0,
        lastShareCount: engagement.share_count || 0,
        videoDuration: videoDuration || null,
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
