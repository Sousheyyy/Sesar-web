import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            tiktokUrl: true,
            tiktokMusicId: true,
            authorName: true,
            duration: true,
            videoCount: true,
          },
        },
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
        submissions: {
          take: 50,
          select: {
            id: true,
            status: true,
            tiktokUrl: true,
            lastViewCount: true,
            lastLikeCount: true,
            lastShareCount: true,
            lastCommentCount: true,
            totalPoints: true,
            sharePercent: true,
            estimatedEarnings: true,
            totalEarnings: true,
            createdAt: true,
            creator: {
              select: {
                id: true,
                name: true,
                tiktokHandle: true,
                avatar: true,
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

    // Only the campaign owner or admin can view full details
    if (campaign.artistId !== session.user.id && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
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
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        artistId: true,
        status: true,
        remainingBudget: true,
        _count: { select: { submissions: true } },
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

    // Refund remaining budget and delete campaign
    const refundAmount = Number(campaign.remainingBudget);
    if (refundAmount > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: campaign.artistId },
          data: { balance: { increment: refundAmount } },
        }),
        prisma.transaction.create({
          data: {
            userId: campaign.artistId,
            type: "REFUND",
            amount: refundAmount,
            status: "COMPLETED",
            description: `Kampanya İptal: ${campaign.title}`,
          },
        }),
        prisma.campaign.delete({
          where: { id },
        }),
      ]);
    } else {
      await prisma.campaign.delete({
        where: { id },
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
