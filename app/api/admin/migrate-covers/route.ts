import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { uploadImageFromUrl, STORAGE_BUCKETS } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all songs with TikTok CDN cover images
    const songs = await prisma.song.findMany({
      where: {
        coverImage: { not: null },
      },
      select: { id: true, coverImage: true, tiktokMusicId: true },
    });

    const results: { id: string; status: string; url?: string }[] = [];

    for (const song of songs) {
      if (!song.coverImage) continue;

      // Skip if already a Supabase URL
      if (song.coverImage.includes("supabase")) {
        results.push({ id: song.id, status: "already_migrated" });
        continue;
      }

      const storagePath = `migrate/${song.tiktokMusicId || song.id}/${Date.now()}.jpg`;
      const permanentUrl = await uploadImageFromUrl(
        STORAGE_BUCKETS.COVERS,
        storagePath,
        song.coverImage
      );

      if (permanentUrl) {
        await prisma.song.update({
          where: { id: song.id },
          data: { coverImage: permanentUrl },
        });
        results.push({ id: song.id, status: "migrated", url: permanentUrl });
      } else {
        results.push({ id: song.id, status: "failed" });
      }
    }

    return NextResponse.json({
      total: songs.length,
      migrated: results.filter((r) => r.status === "migrated").length,
      alreadyDone: results.filter((r) => r.status === "already_migrated").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) {
    console.error("Cover migration error:", error);
    return NextResponse.json(
      { error: "Migration failed" },
      { status: 500 }
    );
  }
}
