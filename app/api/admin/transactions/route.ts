import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { safeDecryptBankDetails } from "@/server/lib/encryption";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const url = req.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(250, Math.max(1, parseInt(url.searchParams.get("limit") || "250")));
    const type = url.searchParams.get("type"); // comma-separated: "DEPOSIT,WITHDRAWAL"
    const status = url.searchParams.get("status"); // comma-separated: "PENDING,COMPLETED"
    const search = url.searchParams.get("search")?.trim();
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Prisma.TransactionWhereInput = {};

    if (type) {
      const types = type.split(",").filter(Boolean);
      if (types.length > 0) {
        where.type = { in: types as any[] };
      }
    }

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length > 0) {
        where.status = { in: statuses as any[] };
      }
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { tiktokHandle: { contains: search, mode: "insensitive" } } },
        { description: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Build orderBy
    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      sortBy === "amount"
        ? { amount: sortOrder === "asc" ? "asc" : "desc" }
        : { createdAt: sortOrder === "asc" ? "asc" : "desc" };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          description: true,
          reference: true,
          notes: true,
          bankDetails: true,
          approvedBy: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true,
              tiktokAvatarUrl: true,
              tiktokHandle: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const serialized = transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      bankDetails: safeDecryptBankDetails(t.bankDetails),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      approvedAt: t.approvedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      transactions: serialized,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("Admin transactions API error:", error);
    return NextResponse.json(
      { error: "İşlemler yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}
