import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

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

    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { platformFeePercent, safetyReservePercent } = await req.json();

    // Validate percentages
    if (
      typeof platformFeePercent !== "number" ||
      platformFeePercent < 0 ||
      platformFeePercent > 100
    ) {
      return NextResponse.json(
        { error: "Invalid platform fee percentage" },
        { status: 400 }
      );
    }

    if (
      typeof safetyReservePercent !== "number" ||
      safetyReservePercent < 0 ||
      safetyReservePercent > 100
    ) {
      return NextResponse.json(
        { error: "Invalid safety reserve percentage" },
        { status: 400 }
      );
    }

    // Ensure total doesn't exceed 100%
    if (platformFeePercent + safetyReservePercent >= 100) {
      return NextResponse.json(
        { error: "Combined fees cannot be 100% or more" },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Campaign is not pending approval" },
        { status: 400 }
      );
    }

    // Approve the campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: "ACTIVE",
        platformFeePercent,
        safetyReservePercent,
      },
      include: {
        song: true,
        artist: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create notification for artist
    await prisma.notification.create({
      data: {
        userId: campaign.artistId,
        title: "Kampanya Onaylandı",
        message: `"${campaign.title}" kampanyanız onaylandı ve şimdi aktif!`,
        link: `/artist/campaigns/${campaign.id}`,
      },
    });

    return NextResponse.json(updatedCampaign);
  } catch (error) {
    console.error("Campaign approval error:", error);
    return NextResponse.json(
      { error: "Failed to approve campaign" },
      { status: 500 }
    );
  }
}






