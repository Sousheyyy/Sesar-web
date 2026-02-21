import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();

    const body = await req.json();
    const { amount, type, reason } = body as {
      amount: number;
      type: "add" | "deduct";
      reason?: string;
    };

    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: "Geçersiz tutar (0 - 1.000.000 arası olmalı)" }, { status: 400 });
    }

    if (type !== "add" && type !== "deduct") {
      return NextResponse.json({ error: "Geçersiz işlem tipi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    // Check sufficient balance for deductions
    if (type === "deduct" && Number(user.balance) < amount) {
      return NextResponse.json(
        { error: "Yetersiz bakiye" },
        { status: 400 }
      );
    }

    // Atomic transaction: update balance + create transaction record
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          balance: type === "add"
            ? { increment: amount }
            : { decrement: amount },
        },
      }),
      prisma.transaction.create({
        data: {
          userId: id,
          type: "ADJUSTMENT",
          amount,
          status: "COMPLETED",
          description: type === "add"
            ? `Admin bakiye ekleme: ${reason || "Manuel düzenleme"}`
            : `Admin bakiye düşme: ${reason || "Manuel düzenleme"}`,
          approvedBy: admin.id,
          approvedAt: new Date(),
        },
      }),
    ]);

    logAdminAction(admin.id, admin.email, "USER_BALANCE_ADJUST", "User", id, { type, amount, reason });

    return NextResponse.json({
      success: true,
      balance: Number(updatedUser.balance),
    });
  } catch (error) {
    console.error("Balance adjustment error:", error);
    return NextResponse.json(
      { error: "Bakiye güncellenemedi" },
      { status: 500 }
    );
  }
}
