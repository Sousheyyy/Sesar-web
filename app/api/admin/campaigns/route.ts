import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        totalBudget: true,
        remainingBudget: true,
        commissionPercent: true,
        durationDays: true,
        createdAt: true,
        startDate: true,
        endDate: true,
        artistId: true,
        song: {
          select: { id: true, title: true, coverImage: true, authorName: true },
        },
        artist: {
          select: { id: true, name: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Admin campaigns fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}


