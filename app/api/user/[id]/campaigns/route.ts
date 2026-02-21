import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view user campaigns
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { artistId: id },
      select: {
        id: true,
        title: true,
        status: true,
        totalBudget: true,
        remainingBudget: true,
        commissionPercent: true,
        durationDays: true,
        payoutStatus: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        completedAt: true,
        song: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = campaigns.map((c) => ({
      ...c,
      totalBudget: Number(c.totalBudget),
      remainingBudget: Number(c.remainingBudget),
      startDate: c.startDate?.toISOString() ?? null,
      endDate: c.endDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      completedAt: c.completedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ campaigns: serialized });
  } catch (error) {
    console.error("Error fetching user campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
