import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";
import { getCommissionFromBudget, MIN_BUDGET_TL, MAX_BUDGET_TL, MIN_DURATION_DAYS, MAX_DURATION_DAYS } from "@/server/lib/tierUtils";
import { z } from "zod";

const createCampaignSchema = z.object({
  songId: z.string().min(1, "Şarkı seçilmelidir"),
  title: z.string().min(3, "Başlık en az 3 karakter olmalı").max(100, "Başlık en fazla 100 karakter olabilir"),
  description: z.string().max(1000, "Açıklama en fazla 1000 karakter olabilir").optional().nullable(),
  totalBudget: z.number().positive("Bütçe pozitif bir sayı olmalı"),
  durationDays: z.number().int("Süre tam sayı olmalı").positive("Süre pozitif olmalı"),
  minVideoDuration: z.number().int().positive().optional().nullable(),
});

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
        { error: "Only artists can create campaigns" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    const { songId, title, description, totalBudget, durationDays, minVideoDuration } = parsed.data;

    // Read dynamic limits from SystemSettings (fallback to hardcoded defaults)
    const settingsRows = await prisma.systemSettings.findMany({
      where: { key: { in: ["min_budget", "max_budget", "min_duration", "max_duration", "commission_percent"] } },
    });
    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows) settingsMap[row.key] = row.value;

    const minBudget = parseInt(settingsMap.min_budget) || MIN_BUDGET_TL;
    const maxBudget = parseInt(settingsMap.max_budget) || MAX_BUDGET_TL;
    const minDuration = parseInt(settingsMap.min_duration) || MIN_DURATION_DAYS;
    const maxDuration = parseInt(settingsMap.max_duration) || MAX_DURATION_DAYS;

    // Validate budget
    if (totalBudget < minBudget) {
      return NextResponse.json(
        { error: `Minimum campaign budget is ₺${minBudget.toLocaleString()}` },
        { status: 400 }
      );
    }

    if (totalBudget > maxBudget) {
      return NextResponse.json(
        { error: `Maximum campaign budget is ₺${maxBudget.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Validate duration
    if (!durationDays || durationDays < minDuration || durationDays > maxDuration) {
      return NextResponse.json(
        { error: `Campaign duration must be between ${minDuration} and ${maxDuration} days` },
        { status: 400 }
      );
    }

    // Commission: read from DB settings, fallback to budget bracket calculation
    const commissionPercent = parseInt(settingsMap.commission_percent) || getCommissionFromBudget(totalBudget) || 20;

    // Check if user has sufficient balance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || Number(user.balance) < totalBudget) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Verify song belongs to user
    const song = await prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song || (song.artistId !== session.user.id && session.user.role !== UserRole.ADMIN)) {
      return NextResponse.json(
        { error: "Song not found or unauthorized" },
        { status: 404 }
      );
    }

    // Create campaign and deduct balance in a transaction
    // startDate and endDate are null - set on admin approval
    const campaign = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: totalBudget } },
      });

      await tx.transaction.create({
        data: {
          userId: session.user.id,
          type: "SPEND",
          amount: totalBudget,
          status: "COMPLETED",
          description: `Campaign created: ${title}`,
        },
      });

      return await tx.campaign.create({
        data: {
          songId,
          artistId: session.user.id,
          title,
          description: description || null,
          totalBudget,
          remainingBudget: totalBudget,
          minVideoDuration: minVideoDuration || null,
          startDate: null,
          endDate: null,
          status: "PENDING_APPROVAL",
          durationDays,
          commissionPercent,
        },
        include: {
          song: true,
        },
      });
    });

    const response = NextResponse.json(campaign, { status: 201 });
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "POST",
      201,
      session.user.id
    );
    return response;
  } catch (error) {
    console.error("Campaign creation error:", error);
    const response = NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
    try {
      const session = await auth();
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "POST",
        500,
        session?.user?.id
      );
    } catch { }
    return response;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100); // Max 100 per page
    const skip = (page - 1) * limit;

    let where: any = {};

    if (!session?.user) {
      // Public campaigns (unauthenticated users see active only)
      where.status = "ACTIVE";
    } else {
      // User's campaigns
      if (session.user.role === UserRole.ARTIST) {
        where.artistId = session.user.id;
      }

      if (status) {
        where.status = status;
      }
    }

    // Get total count for pagination
    const total = await prisma.campaign.count({ where });

    // Fetch paginated campaigns
    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        song: true,
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    const response = NextResponse.json({
      data: campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
    // Log API call
    try {
      const session = await auth();
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "GET",
        200,
        session?.user?.id
      );
    } catch { }
    return response;
  } catch (error) {
    console.error("Campaigns fetch error:", error);
    const response = NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
    // Log API call error
    try {
      const session = await auth();
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "GET",
        500,
        session?.user?.id
      );
    } catch { }
    return response;
  }
}


