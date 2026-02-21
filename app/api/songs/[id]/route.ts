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
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const song = await prisma.song.findUnique({
      where: { id },
      include: {
        artist: {
          select: { id: true, name: true },
        },
        campaigns: {
          select: {
            id: true,
            title: true,
            status: true,
            totalBudget: true,
            remainingBudget: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            submissions: {
              select: {
                lastViewCount: true,
                lastLikeCount: true,
                lastCommentCount: true,
                lastShareCount: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" as const },
        },
      },
    });

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    if (
      session.user.role !== UserRole.ADMIN &&
      song.artistId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Unauthorized to view this song" },
        { status: 403 }
      );
    }

    const allSubmissions = song.campaigns.flatMap(c => c.submissions);
    const aggregates = {
      totalViews: allSubmissions.reduce((s, sub) => s + sub.lastViewCount, 0),
      totalLikes: allSubmissions.reduce((s, sub) => s + sub.lastLikeCount, 0),
      totalComments: allSubmissions.reduce((s, sub) => s + sub.lastCommentCount, 0),
      totalShares: allSubmissions.reduce((s, sub) => s + sub.lastShareCount, 0),
      totalCampaigns: song.campaigns.length,
      totalSubmissions: allSubmissions.length,
    };

    return NextResponse.json(
      { ...song, aggregates },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("Song fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch song" },
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

    // Get the song to check ownership
    const song = await prisma.song.findUnique({
      where: { id },
      select: {
        id: true,
        artistId: true,
        title: true,
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
    });

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Only the artist or admin can delete
    if (
      session.user.role !== UserRole.ADMIN &&
      song.artistId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Unauthorized to delete this song" },
        { status: 403 }
      );
    }

    // Check if song is used in any campaigns
    if (song._count.campaigns > 0) {
      return NextResponse.json(
        { error: `Cannot delete song. It is used in ${song._count.campaigns} campaign(s).` },
        { status: 400 }
      );
    }

    // Delete the song
    await prisma.song.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Song deleted successfully" });
  } catch (error: any) {
    console.error("Song deletion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete song" },
      { status: 500 }
    );
  }
}



