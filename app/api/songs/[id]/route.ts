import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the song to check ownership
    const song = await prisma.song.findUnique({
      where: { id: params.id },
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
      where: { id: params.id },
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







