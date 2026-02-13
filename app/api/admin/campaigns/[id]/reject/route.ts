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

    const body = await req.json();
    const reason = body?.reason;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
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

    // Reject campaign and refund the budget to artist
    await prisma.$transaction(async (tx) => {
      // Update campaign status with rejection reason
      await tx.campaign.update({
        where: { id: params.id },
        data: {
          status: "CANCELLED",
          rejectionReason: reason.trim(),
        },
      });

      // Refund the budget to artist
      await tx.user.update({
        where: { id: campaign.artistId },
        data: {
          balance: {
            increment: campaign.totalBudget,
          },
        },
      });

      // Create refund transaction record
      await tx.transaction.create({
        data: {
          userId: campaign.artistId,
          type: "REFUND",
          amount: campaign.totalBudget,
          status: "COMPLETED",
          description: `Campaign rejected: ${campaign.title}${reason ? ` - ${reason}` : ""}`,
        },
      });

      // Create notification for artist
      await tx.notification.create({
        data: {
          userId: campaign.artistId,
          title: "Kampanya Reddedildi",
          message: `"${campaign.title}" kampanyanız reddedildi ve bütçeniz iade edildi.${reason ? ` Sebep: ${reason}` : ""}`,
          link: `/artist/campaigns/${campaign.id}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Campaign rejection error:", error);
    return NextResponse.json(
      { error: "Failed to reject campaign" },
      { status: 500 }
    );
  }
}






