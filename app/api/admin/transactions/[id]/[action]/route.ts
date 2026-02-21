import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params;
    const admin = await requireAdmin();

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        type: true,
        amount: true,
        status: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.status !== "PENDING") {
      return NextResponse.json(
        { error: "Transaction already processed" },
        { status: 400 }
      );
    }

    // Only DEPOSIT and WITHDRAWAL can be processed through this route
    if (transaction.type !== "DEPOSIT" && transaction.type !== "WITHDRAWAL") {
      return NextResponse.json(
        { error: "Only deposit and withdrawal transactions can be processed" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      if (transaction.type === "DEPOSIT") {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: transaction.userId },
            data: { balance: { increment: transaction.amount } },
          }),
          prisma.transaction.update({
            where: { id },
            data: {
              status: "COMPLETED",
              approvedBy: admin.id,
              approvedAt: new Date(),
            },
          }),
        ]);

        await prisma.notification.create({
          data: {
            userId: transaction.userId,
            title: "Para Yatırma Onaylandı",
            message: `${transaction.amount} TL tutarındaki para yatırma işleminiz onaylandı ve cüzdanınıza eklendi`,
            link: "/artist/wallet",
          },
        });
      } else {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: transaction.userId },
            data: { balance: { decrement: transaction.amount } },
          }),
          prisma.transaction.update({
            where: { id },
            data: {
              status: "COMPLETED",
              approvedBy: admin.id,
              approvedAt: new Date(),
            },
          }),
        ]);

        await prisma.notification.create({
          data: {
            userId: transaction.userId,
            title: "Para Çekme Onaylandı",
            message: `${transaction.amount} TL tutarındaki para çekme işleminiz onaylandı ve işleme alındı`,
            link: "/artist/wallet",
          },
        });
      }

      logAdminAction(admin.id, admin.email, "TRANSACTION_APPROVE", "Transaction", id, { type: transaction.type, amount: Number(transaction.amount) });

      return NextResponse.json({
        success: true,
        message: "Transaction approved",
      });
    } else {
      await prisma.transaction.update({
        where: { id },
        data: {
          status: "REJECTED",
          approvedBy: admin.id,
          approvedAt: new Date(),
        },
      });

      const typeLabel = transaction.type === "DEPOSIT" ? "para yatırma" : "para çekme";
      await prisma.notification.create({
        data: {
          userId: transaction.userId,
          title: "İşlem Reddedildi",
          message: `${transaction.amount} TL tutarındaki ${typeLabel} talebiniz reddedildi`,
          link: "/artist/wallet",
        },
      });

      logAdminAction(admin.id, admin.email, "TRANSACTION_REJECT", "Transaction", id, { type: transaction.type, amount: Number(transaction.amount) });

      return NextResponse.json({
        success: true,
        message: "Transaction rejected",
      });
    }
  } catch (error) {
    console.error("Transaction approval error:", error);
    return NextResponse.json(
      { error: "Failed to process transaction" },
      { status: 500 }
    );
  }
}
