import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(250, Math.max(1, parseInt(searchParams.get("limit") || "250", 10)));
    const action = searchParams.get("action");
    const adminId = searchParams.get("adminId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (adminId) where.adminId = adminId;
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
