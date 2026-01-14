import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const method = searchParams.get("method"); // Filter by HTTP method
    const userId = searchParams.get("userId"); // Filter by user ID
    const username = searchParams.get("username"); // Filter by username (searches name or email)

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    // Parse date and set time range for that day in UTC
    // The date comes from the chart which uses UTC dates (YYYY-MM-DD format from toISOString().split("T")[0])
    // So we need to ensure we're filtering in UTC to match the grouping logic
    // Create start and end of day in UTC to match how the chart groups dates
    const startOfDay = new Date(date + "T00:00:00.000Z"); // Midnight UTC on the given date
    const endOfDay = new Date(date + "T23:59:59.999Z"); // End of day UTC on the given date

    // Build where clause with filters
    const whereClause: any = {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    // Apply method filter
    if (method) {
      whereClause.method = method;
    }

    // Handle user filtering - username takes precedence over userId
    if (username) {
      // If username filter is provided, we need to fetch matching users first
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: username, mode: "insensitive" } },
            { email: { contains: username, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      const filteredUserIds = matchingUsers.map((u) => u.id);

      // If no users match, return empty results
      if (filteredUserIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
      }

      // Add userId filter with matching user IDs
      whereClause.userId = { in: filteredUserIds };
    } else if (userId) {
      // Apply user ID filter only if username filter is not provided
      whereClause.userId = userId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await prisma.apiCallLog.count({
      where: whereClause,
    });

    // Fetch paginated API call logs
    const apiCalls = await prisma.apiCallLog.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    // Get unique user IDs from the filtered results
    const userIds = Array.from(new Set(apiCalls.map((call) => call.userId).filter(Boolean))) as string[];

    // Fetch user information for all unique users
    const users = userIds.length > 0
      ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      })
      : [];

    // Create a map for quick user lookup
    const userMap = new Map(users.map((user) => [user.id, user]));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: apiCalls.map((call) => ({
        id: call.id,
        endpoint: call.endpoint,
        method: call.method,
        statusCode: call.statusCode,
        duration: call.duration,
        createdAt: call.createdAt.toISOString(),
        user: call.userId && userMap.has(call.userId)
          ? {
            id: userMap.get(call.userId)!.id,
            name: userMap.get(call.userId)!.name,
            email: userMap.get(call.userId)!.email,
            role: userMap.get(call.userId)!.role,
          }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error("Error fetching API call details:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch API call details" },
      { status: 500 }
    );
  }
}

