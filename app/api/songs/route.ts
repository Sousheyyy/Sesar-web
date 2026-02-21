import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== UserRole.ARTIST && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only artists can upload songs" },
        { status: 403 }
      );
    }

    const { title, description, tiktokUrl, duration, coverImage } = await req.json();

    if (!title || !tiktokUrl || !duration) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const song = await prisma.song.create({
      data: {
        title,
        description: description || null,
        tiktokUrl,
        duration,
        coverImage: coverImage || null,
        artistId: session.user.id,
      },
    });

    return NextResponse.json(song, { status: 201 });
  } catch (error) {
    console.error("Song creation error:", error);
    return NextResponse.json(
      { error: "Failed to create song" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100); // Max 100 per page
    const skip = (page - 1) * limit;

    const where = {
      artistId: session.user.id,
    };

    // Get total count for pagination
    const total = await prisma.song.count({ where });

    // Fetch paginated songs
    const songs = await prisma.song.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        duration: true,
        description: true,
        coverImage: true,
        tiktokUrl: true,
        tiktokMusicId: true,
        videoCount: true,
        authorName: true,
        statsLastFetched: true,
        createdAt: true,
        updatedAt: true,
        artistId: true,
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: songs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Songs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch songs", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
