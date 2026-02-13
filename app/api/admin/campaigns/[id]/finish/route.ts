import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { calculateCampaignPayouts } from "@/lib/payout";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        submissions: {
          where: {
            status: "APPROVED",
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

    if (campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Campaign is not active. Only active campaigns can be finished." },
        { status: 400 }
      );
    }

    if (campaign.payoutStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "Payouts have already been processed for this campaign" },
        { status: 400 }
      );
    }

    // Lock campaign if not already locked
    if (!campaign.lockedAt) {
      await prisma.campaign.update({
        where: { id: params.id },
        data: { lockedAt: new Date() },
      });
    }

    // Process final distribution (insurance → eligibility → Robin Hood → wallet payouts)
    console.log(`Processing final distribution for campaign ${params.id}...`);
    const payoutResult = await calculateCampaignPayouts(params.id);

    return NextResponse.json({
      success: true,
      message: "Campaign finished successfully",
      payout: payoutResult,
    });
  } catch (error: any) {
    console.error("Error finishing campaign:", error);
    return NextResponse.json(
      { error: error.message || "Failed to finish campaign" },
      { status: 500 }
    );
  }
}

