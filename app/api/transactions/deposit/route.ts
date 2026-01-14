import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

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
        { error: "Only artists can make deposits" },
        { status: 403 }
      );
    }

    const { amount, reference } = await req.json();

    if (!amount || !reference) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate amount is a valid number
    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid deposit amount" },
        { status: 400 }
      );
    }

    if (depositAmount < 50) {
      return NextResponse.json(
        { error: "Minimum deposit amount is ₺50" },
        { status: 400 }
      );
    }

    if (depositAmount > 99999999.99) {
      return NextResponse.json(
        { error: "Maximum deposit amount is ₺99,999,999.99" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "DEPOSIT",
        amount: depositAmount,
        status: "PENDING",
        description: "Deposit request via bank transfer",
        reference,
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
            title: "New Deposit Request",
            message: `${session.user.name} requested a deposit of ₺${depositAmount.toFixed(2)}`,
            link: `/admin/transactions`,
          },
        })
      )
    );

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Deposit error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit request" },
      { status: 500 }
    );
  }
}


