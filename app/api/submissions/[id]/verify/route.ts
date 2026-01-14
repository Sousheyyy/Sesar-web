import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tiktokScraper } from "@/lib/tiktok-scraper";
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

    // Scrape TikTok video data
    let videoData;
    try {
      videoData = await tiktokScraper.verifyVideo(submission.tiktokUrl);
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
    let videoCreatorUsername: string | null = null;

    // Try to get creator username from API response first
    if (videoData.creatorUsername) {
      videoCreatorUsername = normalizeUsername(videoData.creatorUsername);
    } else {
      // Fallback: try to extract from URL
      videoCreatorUsername = extractTikTokUsernameFromUrl(submission.tiktokUrl);
      if (videoCreatorUsername) {
        videoCreatorUsername = normalizeUsername(videoCreatorUsername);
      }
    }

    if (!videoCreatorUsername) {
      await prisma.submission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          rejectionReason: "Video sahipliği doğrulanamadı. Lütfen video URL'sinin doğru olduğundan ve videonun herkese açık olduğundan emin olun.",
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Video reddedildi: Video sahipliği doğrulanamadı",
      });
    }

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

    // Verify song
    const songMatches = tiktokScraper.verifySong(
      videoData,
      submission.campaign.song.title
    );

    if (!songMatches) {
      await prisma.submission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          rejectionReason: "Video doğru şarkıyı kullanmıyor",
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Video reddedildi: Yanlış şarkı",
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

    // Check follower requirement
    if (
      submission.campaign.minFollowers &&
      videoData.creatorFollowers !== undefined &&
      videoData.creatorFollowers < submission.campaign.minFollowers
    ) {
      await prisma.submission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          rejectionReason: `İçerik üreticisinin ${videoData.creatorFollowers} takipçisi var, ancak ${submission.campaign.minFollowers} takipçi gerekiyor`,
          verified: false,
        },
      });

      return NextResponse.json({
        success: false,
        message: "Video reddedildi: Yetersiz takipçi",
      });
    }

    // All checks passed - approve submission
    const updatedSubmission = await tiktokScraper.updateSubmissionData(
      params.id,
      videoData
    );

    await prisma.submission.update({
      where: { id: params.id },
      data: {
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
      videoData,
    });
  } catch (error: any) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify submission" },
      { status: 500 }
    );
  }
}


