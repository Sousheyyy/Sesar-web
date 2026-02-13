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

    // Timer starts from approval - use desiredStartDate if in future, else start now
    const now = new Date();
    const desiredStart = campaign.desiredStartDate ? new Date(campaign.desiredStartDate) : now;
    const actualStart = desiredStart > now ? desiredStart : now;
    const endDate = new Date(actualStart.getTime() + campaign.durationDays * 24 * 60 * 60 * 1000);

    // Approve the campaign with dates
    const updatedCampaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: "ACTIVE",
        startDate: actualStart,
        endDate: endDate,
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
        message: `"${campaign.title}" kampanyanız onaylandı ve şimdi aktif! Kampanya ${campaign.durationDays} gün sürecek.`,
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
