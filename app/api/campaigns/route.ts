import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";

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

    const {
      songId,
      title,
      description,
      totalBudget,
      minFollowers,
      minVideoDuration,
      startDate,
      endDate,
      targetTiers, // NEW
      isProOnly,   // NEW
    } = await req.json();

    if (!songId || !title || !totalBudget || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate dates
    const campaignStartDate = new Date(startDate);
    const campaignEndDate = new Date(endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset to start of today

    if (campaignStartDate < now) {
      return NextResponse.json(
        { error: "Start date must be today or in the future" },
        { status: 400 }
      );
    }

    if (campaignEndDate <= campaignStartDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Validate budget
    if (totalBudget < 20000) {
      return NextResponse.json(
        { error: "Minimum campaign budget is ₺20,000" },
        { status: 400 }
      );
    }

    // Calculate Campaign Tier based on Budget
    let tier = "C";
    if (totalBudget >= 100000) {
      tier = "S";
    } else if (totalBudget >= 70000) {
      tier = "A";
    } else if (totalBudget >= 40000) {
      tier = "B";
    }

    // Calculate Max Participants (Automatic)
    // Every 1000 TL = 10 participants => Budget / 100
    const maxParticipants = Math.floor(totalBudget / 100);

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
    const campaign = await prisma.$transaction(async (tx) => {
      // Deduct budget from user balance
      await tx.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: totalBudget } },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: session.user.id,
          type: "SPEND",
          amount: totalBudget,
          status: "COMPLETED",
          description: `Campaign created: ${title}`,
        },
      });

      // Create campaign (pending admin approval)
      return await tx.campaign.create({
        data: {
          songId,
          artistId: session.user.id,
          title,
          description: description || null,
          totalBudget,
          remainingBudget: totalBudget,
          minFollowers: minFollowers || null,
          minVideoDuration: minVideoDuration || null,
          startDate: campaignStartDate,
          endDate: campaignEndDate,
          status: "PENDING_APPROVAL",
          tier: tier as any, // Cast string to Tier enum
          targetTiers: targetTiers || [],
          isProOnly: isProOnly || false,
          maxParticipants: maxParticipants,
        },
        include: {
          song: true,
        },
      });
    });

    const response = NextResponse.json(campaign, { status: 201 });
    // Log API call
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
    // Log API call error
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
      // Public campaigns for marketplace
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


