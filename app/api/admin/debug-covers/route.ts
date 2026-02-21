import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { uploadImageFromUrl, STORAGE_BUCKETS } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    // Get the 5 most recent songs with cover images
    const songs = await prisma.song.findMany({
      where: { coverImage: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        coverImage: true,
        tiktokMusicId: true,
        createdAt: true,
      },
    });

    const diagnostics: any[] = [];

    for (const song of songs) {
      const coverUrl = song.coverImage!;
      const isSupabase = coverUrl.includes("supabase");

      // Test if the URL is accessible
      let urlAccessible = false;
      let urlStatus = 0;
      let urlError = "";
      try {
        const res = await fetch(coverUrl, { method: "HEAD" });
        urlStatus = res.status;
        urlAccessible = res.ok;
      } catch (e: any) {
        urlError = e.message;
      }

      // If not on Supabase, try a test upload
      let testUploadResult: { success: boolean; url?: string } | null = null;
      if (!isSupabase) {
        const testPath = `debug-test/${song.tiktokMusicId || song.id}/${Date.now()}.jpg`;
        const result = await uploadImageFromUrl(STORAGE_BUCKETS.COVERS, testPath, coverUrl);
        testUploadResult = result ? { success: true, url: result } : { success: false };
      }

      diagnostics.push({
        songId: song.id,
        title: song.title,
        coverUrl: coverUrl.substring(0, 120) + (coverUrl.length > 120 ? "..." : ""),
        isSupabase,
        urlAccessible,
        urlStatus,
        urlError: urlError || undefined,
        testUploadResult,
        createdAt: song.createdAt,
      });
    }

    // Check if SUPABASE env vars are set
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    return NextResponse.json({ envCheck, diagnostics });
  } catch (error: any) {
    console.error("Debug covers error:", error);
    return NextResponse.json(
      { error: "Debug failed", details: error.message },
      { status: 500 }
    );
  }
}
