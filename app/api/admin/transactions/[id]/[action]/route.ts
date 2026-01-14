import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, action } = params;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { user: true },
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

    if (action === "approve") {
      // Approve transaction
      if (transaction.type === "DEPOSIT") {
        // Add funds to user balance
        await prisma.$transaction([
          prisma.user.update({
            where: { id: transaction.userId },
            data: { balance: { increment: transaction.amount } },
          }),
          prisma.transaction.update({
            where: { id },
            data: {
              status: "COMPLETED",
              approvedBy: session.user.id,
              approvedAt: new Date(),
            },
          }),
        ]);

        // Notify user
        await prisma.notification.create({
          data: {
            userId: transaction.userId,
            title: "Deposit Approved",
            message: `Your deposit of $${transaction.amount} has been approved and added to your wallet`,
            link: "/wallet",
          },
        });
      } else if (transaction.type === "WITHDRAWAL") {
        // Deduct funds from user balance
        await prisma.$transaction([
          prisma.user.update({
            where: { id: transaction.userId },
            data: { balance: { decrement: transaction.amount } },
          }),
          prisma.transaction.update({
            where: { id },
            data: {
              status: "COMPLETED",
              approvedBy: session.user.id,
              approvedAt: new Date(),
            },
          }),
        ]);

        // Notify user
        await prisma.notification.create({
          data: {
            userId: transaction.userId,
            title: "Withdrawal Approved",
            message: `Your withdrawal of $${transaction.amount} has been approved and processed`,
            link: "/wallet",
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Transaction approved",
      });
    } else {
      // Reject transaction
      await prisma.transaction.update({
        where: { id },
        data: {
          status: "REJECTED",
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      });

      // Notify user
      await prisma.notification.create({
        data: {
          userId: transaction.userId,
          title: "Transaction Rejected",
          message: `Your ${transaction.type.toLowerCase()} request of $${transaction.amount} has been rejected`,
          link: "/wallet",
        },
      });

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








