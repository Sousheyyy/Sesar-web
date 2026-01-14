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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view user campaigns
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        artistId: params.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        totalBudget: true,
        remainingBudget: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Convert Decimal objects to numbers and dates to ISO strings for JSON serialization
    const serializedCampaigns = campaigns.map((campaign) => ({
      ...campaign,
      totalBudget: Number(campaign.totalBudget),
      remainingBudget: Number(campaign.remainingBudget),
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
    }));

    return NextResponse.json({ campaigns: serializedCampaigns });
  } catch (error) {
    console.error("Error fetching user campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

