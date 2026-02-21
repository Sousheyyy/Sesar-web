import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchVideoViaInsightIQ } from "@/lib/insightiq";
import { updateEstimatedPayouts } from "@/lib/payout";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId, tiktokUrl } = await req.json();

    if (!campaignId || !tiktokUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate TikTok URL — accept web (tiktok.com) and mobile (vm.tiktok.com) links
    let isValidTiktokUrl = false;
    try {
      const parsed = new URL(tiktokUrl);
      const host = parsed.hostname.toLowerCase();
      isValidTiktokUrl =
        host === "tiktok.com" ||
        host === "www.tiktok.com" ||
        host === "vm.tiktok.com" ||
        host === "m.tiktok.com" ||
        host === "vt.tiktok.com";
    } catch {
      isValidTiktokUrl = false;
    }

    if (!isValidTiktokUrl) {
      return NextResponse.json(
        { error: "Geçersiz TikTok linki. Lütfen tiktok.com veya vm.tiktok.com adresinden bir link girin." },
        { status: 400 }
      );
    }

    // VERIFICATION STEP 1: Check if user has connected TikTok profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, tiktokHandle: true, creatorTier: true, plan: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please log out and log in again." },
        { status: 404 }
      );
    }

    if (!user.tiktokHandle || user.tiktokHandle.trim() === "") {
      return NextResponse.json(
        {
          error: "You must connect your TikTok profile before submitting videos. Please go to your profile settings to connect your account."
        },
        { status: 400 }
      );
    }

    // Check if campaign exists and is active
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { song: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Campaign is not active" },
        { status: 400 }
      );
    }

    if (Number(campaign.remainingBudget) <= 0) {
      return NextResponse.json(
        { error: "Campaign budget depleted" },
        { status: 400 }
      );
    }

    // Check if user already submitted to this campaign
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        campaignId,
        creatorId: session.user.id,
      },
    });

    // If submission exists and is not rejected, block resubmission
    if (existingSubmission && existingSubmission.status !== "REJECTED") {
      const statusMessage = existingSubmission.status === "APPROVED"
        ? "You have already submitted to this campaign and your submission was approved."
        : "You have already submitted to this campaign. Please wait for your submission to be reviewed.";

      return NextResponse.json(
        { error: statusMessage },
        { status: 400 }
      );
    }

    // If there's a rejected submission, update it instead of creating a new one
    let submission;
    if (existingSubmission && existingSubmission.status === "REJECTED") {
      // Update the rejected submission with new video URL and reset status
      submission = await prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          tiktokUrl,
          status: "PENDING",
          verified: false,
          rejectionReason: null,
          verifiedAt: null,
          // Reset metrics
          lastViewCount: 0,
          lastLikeCount: 0,
          lastCommentCount: 0,
          lastShareCount: 0,
          tiktokVideoId: null,
          insightiqContentId: null,
          creatorFollowers: null,
          videoDuration: null,
        },
        include: {
          campaign: {
            include: {
              song: true,
            },
          },
        },
      });
    } else {
      // Create new submission
      submission = await prisma.submission.create({
        data: {
          campaignId,
          creatorId: session.user.id,
          tiktokUrl,
          status: "PENDING",
          verified: false,
        },
        include: {
          campaign: {
            include: {
              song: true,
            },
          },
        },
      });
    }

    // Attempt automatic verification via InsightIQ
    let autoVerificationSuccess = false;
    let rejectionReason = "";

    try {
      const contentData = await fetchVideoViaInsightIQ(tiktokUrl);

      // VERIFICATION STEP 2: Verify video ownership
      const normalizeUsername = (username: string) => {
        return username.replace(/^@/, "").toLowerCase().trim();
      };

      const userHandle = normalizeUsername(user.tiktokHandle);
      const videoUsername = contentData.profile?.platform_username?.toLowerCase() || contentData.creator?.platform_username?.toLowerCase() || "";

      if (!videoUsername || normalizeUsername(videoUsername) !== userHandle) {
        rejectionReason = `Bu video bağlı TikTok hesabınıza (@${user.tiktokHandle}) ait değil. Lütfen kendi hesabınızdan bir video gönderin.`;
      }

      // VERIFICATION STEP 3: Check if song matches
      if (!rejectionReason) {
        const audioTrack = contentData.audio_track_info || contentData.music;
        let isSongMatch = false;
        if (audioTrack) {
          const trackTitle = (audioTrack.title || audioTrack.name || '').toLowerCase();
          const campaignSongTitle = (campaign.song.title || '').toLowerCase();
          const titleMatch = trackTitle.includes(campaignSongTitle) || campaignSongTitle.includes(trackTitle);
          const idMatch = !!(campaign.song.tiktokMusicId && (audioTrack.platform_audio_id || audioTrack.id) === campaign.song.tiktokMusicId);
          isSongMatch = !!(titleMatch || idMatch);
        }
        if (!isSongMatch) {
          rejectionReason = `Video doğru şarkıyı kullanmıyor: Kampanya şarkısı "${campaign.song.title}" videoda bulunamadı.`;
        }
      }

      // VERIFICATION STEP 4: Check duration requirement
      if (!rejectionReason && campaign.minVideoDuration) {
        const videoDuration = contentData.duration || 0;
        if (videoDuration < campaign.minVideoDuration) {
          rejectionReason = `Video süresi (${videoDuration}sn) gereken süreden (${campaign.minVideoDuration}sn) kısa`;
        }
      }

      // All checks passed
      if (!rejectionReason) {
        const engagement = contentData.engagement || {};

        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            tiktokVideoId: contentData.platform_content_id || contentData.id,
            insightiqContentId: contentData.id,
            lastViewCount: engagement.view_count || 0,
            lastLikeCount: engagement.like_count || 0,
            lastCommentCount: engagement.comment_count || 0,
            lastShareCount: engagement.share_count || 0,
            videoDuration: contentData.duration || null,
            verified: true,
            verifiedAt: new Date(),
            lastCheckedAt: new Date(),
            status: "APPROVED"
          }
        });

        // Notify creator of approval
        await prisma.notification.create({
          data: {
            userId: session.user.id,
            title: "Submission Approved!",
            message: `Your submission for "${campaign.title}" has been automatically approved.`,
            link: `/dashboard/submissions`,
          },
        });

        // Update estimated payouts for all participants since a new creator entered the pool
        await updateEstimatedPayouts(campaignId);

        autoVerificationSuccess = true;
      } else {
        // Reject submission
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: "REJECTED",
            rejectionReason,
            verified: false,
          },
        });

        // Notify creator of rejection
        await prisma.notification.create({
          data: {
            userId: session.user.id,
            title: "Gönderi Reddedildi",
            message: `"${campaign.title}" kampanyası için gönderiniz reddedildi: ${rejectionReason}`,
            link: `/dashboard/submissions`,
          },
        });
      }
    } catch (verificationError: any) {
      // Handle verification errors gracefully
      console.warn("Automatic verification failed, submission kept as PENDING:", verificationError);

      // Check for specific error types
      if (verificationError.message?.includes("private") || verificationError.message?.includes("not found") || verificationError.message?.includes("herkese açık")) {
        // Video is inaccessible - reject it
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: "REJECTED",
            rejectionReason: "Video özel, silinmiş veya erişilebilir değil",
            verified: false,
          },
        });

        await prisma.notification.create({
          data: {
            userId: session.user.id,
            title: "Gönderi Reddedildi",
            message: `"${campaign.title}" kampanyası için gönderiniz reddedildi: Video erişilebilir değil`,
            link: `/dashboard/submissions`,
          },
        });
      }
      // For rate limits or other API errors, leave as PENDING for manual verification
    }

    // Notify artist about new submission
    await prisma.notification.create({
      data: {
        userId: campaign.artistId,
        title: autoVerificationSuccess ? "Gönderi Otomatik Onaylandı" : "Yeni Gönderi",
        message: autoVerificationSuccess
          ? `"${campaign.title}" kampanyası için bir gönderi otomatik olarak onaylandı.`
          : rejectionReason
            ? `"${campaign.title}" kampanyası için bir gönderi otomatik olarak reddedildi: ${rejectionReason}`
            : `Bir içerik üreticisi kampanyanız için video gönderdi: ${campaign.title}`,
        link: `/artist/campaigns/${campaign.id}`,
      },
    });

    // Fetch updated submission to return
    const updatedSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
      include: {
        campaign: {
          include: {
            song: true,
          },
        },
      },
    });

    const response = NextResponse.json(updatedSubmission, { status: 201 });
    // Log API call
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      201,
      session.user.id
    );
    return response;
  } catch (error) {
    console.error("Submission creation error:", error);
    const response = NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
    // Log API call error
    try {
      const session = await auth();
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        500,
        session?.user?.id
      );
    } catch { }
    return response;
  }
}
