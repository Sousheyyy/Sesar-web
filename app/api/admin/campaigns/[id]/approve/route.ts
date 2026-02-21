import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();

    const campaign = await prisma.campaign.findUnique({
      where: { id },
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
      where: { id },
      data: {
        status: "ACTIVE",
        startDate: actualStart,
        endDate: endDate,
      },
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        durationDays: true,
        totalBudget: true,
        artistId: true,
        song: {
          select: { id: true, title: true },
        },
        artist: {
          select: { id: true, name: true },
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

    logAdminAction(admin.id, admin.email, "CAMPAIGN_APPROVE", "Campaign", id, { title: campaign.title });

    return NextResponse.json(updatedCampaign);
  } catch (error) {
    console.error("Campaign approval error:", error);
    return NextResponse.json(
      { error: "Failed to approve campaign" },
      { status: 500 }
    );
  }
}
