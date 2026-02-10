import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        song: true,
        artist: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        submissions: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                tiktokHandle: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Campaign fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Check permissions
    if (
      campaign.artistId !== session.user.id &&
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Unauthorized to edit this campaign" },
        { status: 403 }
      );
    }

    const updateData = await req.json();

    // Only allow certain fields to be updated
    const allowedUpdates = {
      title: updateData.title,
      description: updateData.description,
      status: updateData.status,
      minVideoDuration: updateData.minVideoDuration,
    };

    const updatedCampaign = await prisma.campaign.update({
      where: { id: params.id },
      data: Object.fromEntries(
        Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
      ),
      include: {
        song: true,
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(updatedCampaign);
  } catch (error) {
    console.error("Campaign update error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        submissions: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check permissions
    if (
      campaign.artistId !== session.user.id &&
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Unauthorized to delete this campaign" },
        { status: 403 }
      );
    }

    // Refund remaining budget if campaign has submissions
    if (campaign.submissions.length > 0 && Number(campaign.remainingBudget) > 0) {
      await prisma.$transaction([
        // Refund remaining budget
        prisma.user.update({
          where: { id: campaign.artistId },
          data: { balance: { increment: campaign.remainingBudget } },
        }),
        // Create refund transaction
        prisma.transaction.create({
          data: {
            userId: campaign.artistId,
            type: "REFUND",
            amount: campaign.remainingBudget,
            status: "COMPLETED",
            description: `Campaign cancelled: ${campaign.title}`,
          },
        }),
        // Delete campaign
        prisma.campaign.delete({
          where: { id: params.id },
        }),
      ]);
    } else {
      // Just delete if no submissions
      await prisma.campaign.delete({
        where: { id: params.id },
      });
    }

    return NextResponse.json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error("Campaign deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}



