import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { encryptBankDetails } from "@/server/lib/encryption";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount, bankDetails } = await req.json();

    if (!amount || !bankDetails) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount < 500) {
      return NextResponse.json(
        { error: "Minimum withdrawal amount is ₺500" },
        { status: 400 }
      );
    }

    // Check balance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || Number(user.balance) < amount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "WITHDRAWAL",
        amount,
        status: "PENDING",
        description: "Withdrawal request to bank account",
        bankDetails: encryptBankDetails(JSON.stringify(bankDetails)),
      },
    });

    // Create notification for admins
    const admins = await prisma.user.findMany({
      where: { role: UserRole.ADMIN },
    });

    await Promise.all(
      admins.map((admin) =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            title: "New Withdrawal Request",
            message: `${session.user.name} requested a withdrawal of $${amount}`,
            link: `/admin/transactions`,
          },
        })
      )
    );

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Withdrawal error:", error);
    return NextResponse.json(
      { error: "Failed to create withdrawal request" },
      { status: 500 }
    );
  }
}


