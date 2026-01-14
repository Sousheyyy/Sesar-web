import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    
    // Get date range from params or use default
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const days = parseInt(searchParams.get("days") || "30", 10);

    let startDate: Date;
    let endDate: Date | null = null;

    if (startDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Default to last N days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    if (endDateParam) {
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
    }

    // Build where clause
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        ...(endDate && { lte: endDate }),
      },
    };

    // Fetch API call logs grouped by endpoint and date
    const apiCalls = await prisma.apiCallLog.findMany({
      where: whereClause,
      select: {
        endpoint: true,
        method: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit * 100, // Get more data to group properly
    });

    // Group by date and endpoint
    const groupedData = new Map<string, Map<string, number>>();

    apiCalls.forEach((call) => {
      const date = new Date(call.createdAt);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
      const endpointKey = `${call.method} ${call.endpoint}`;

      if (!groupedData.has(dateKey)) {
        groupedData.set(dateKey, new Map());
      }

      const endpointMap = groupedData.get(dateKey)!;
      endpointMap.set(
        endpointKey,
        (endpointMap.get(endpointKey) || 0) + 1
      );
    });

    // Get all unique endpoints
    const allEndpoints = new Set<string>();
    groupedData.forEach((endpointMap) => {
      endpointMap.forEach((_, endpoint) => allEndpoints.add(endpoint));
    });

    // Convert to array format for chart
    const chartData = Array.from(groupedData.entries())
      .map(([date, endpointMap]) => {
        const dataPoint: Record<string, string | number> = { date };
        allEndpoints.forEach((endpoint) => {
          dataPoint[endpoint] = endpointMap.get(endpoint) || 0;
        });
        return dataPoint;
      })
      .sort((a, b) => (a.date as string).localeCompare(b.date as string));

    return NextResponse.json({
      data: chartData,
      endpoints: Array.from(allEndpoints),
    });
  } catch (error: any) {
    console.error("Error fetching API calls:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch API calls" },
      { status: 500 }
    );
  }
}

