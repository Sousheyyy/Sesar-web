import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view user submissions
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope"); // "artist" = submissions TO this user's campaigns

    const where =
      scope === "artist"
        ? { campaign: { artistId: id } }
        : { creatorId: id };

    const submissions = await prisma.submission.findMany({
      where,
      select: {
        id: true,
        tiktokUrl: true,
        tiktokVideoId: true,
        status: true,
        verified: true,
        verifiedAt: true,
        videoDuration: true,
        // Engagement metrics
        lastViewCount: true,
        lastLikeCount: true,
        lastCommentCount: true,
        lastShareCount: true,
        // Earnings
        totalEarnings: true,
        estimatedEarnings: true,
        payoutAmount: true,
        contributionPercent: true,
        // Timestamps
        createdAt: true,
        lastCheckedAt: true,
        // Campaign info
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        // Creator info (useful for artist scope)
        creator: {
          select: {
            id: true,
            name: true,
            tiktokHandle: true,
            tiktokAvatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = submissions.map((s) => ({
      ...s,
      totalEarnings: Number(s.totalEarnings),
      estimatedEarnings: Number(s.estimatedEarnings),
      payoutAmount: s.payoutAmount ? Number(s.payoutAmount) : null,
      createdAt: s.createdAt.toISOString(),
      verifiedAt: s.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ data: serialized });
  } catch (error) {
    console.error("Error fetching user submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
