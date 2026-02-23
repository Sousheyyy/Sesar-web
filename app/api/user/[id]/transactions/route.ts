import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { safeDecryptBankDetails } from "@/server/lib/encryption";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: id },
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
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      bankDetails: safeDecryptBankDetails(t.bankDetails),
      createdAt: t.createdAt.toISOString(),
      approvedAt: t.approvedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ transactions: serialized });
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
