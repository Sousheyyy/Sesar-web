import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole, TransactionType, TransactionStatus } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "revenue" | "payouts" | "platformFee" | "safetyReserve" | "totalBank"

    if (!type) {
      return NextResponse.json({ error: "Type parameter required" }, { status: 400 });
    }

    let transactions: any[] = [];

    if (type === "revenue") {
      // Revenue = Platform fees from approved campaigns
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: { in: ["ACTIVE", "COMPLETED"] },
        },
        include: {
          artist: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      transactions = campaigns
        .map((campaign) => {
          const budget = Number(campaign.totalBudget) || 0;
          const platformFeePercent = campaign.platformFeePercent || 0;
          const feeAmount = (budget * platformFeePercent) / 100;

          if (feeAmount > 0) {
            return {
              id: `campaign-${campaign.id}-platform-fee`,
              type: "DEPOSIT" as TransactionType,
              amount: feeAmount,
              status: "COMPLETED" as TransactionStatus,
              description: `Platform ücreti: ${campaign.title}`,
              createdAt: campaign.createdAt,
              user: campaign.artist,
            };
          }
          return null;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (type === "payouts") {
      // Get all WITHDRAWAL transactions
      transactions = await prisma.transaction.findMany({
        where: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
    } else if (type === "platformFee" || type === "safetyReserve") {
      // For platform fees and safety reserves, we need to calculate from campaigns
      // Get approved campaigns and create virtual transactions
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: { in: ["ACTIVE", "COMPLETED"] },
        },
        include: {
          artist: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      transactions = campaigns
        .map((campaign) => {
          const budget = Number(campaign.totalBudget) || 0;
          const platformFeePercent = campaign.platformFeePercent || 0;
          const safetyReservePercent = campaign.safetyReservePercent || 0;

          if (type === "platformFee" && platformFeePercent > 0) {
            const feeAmount = (budget * platformFeePercent) / 100;
            return {
              id: `campaign-${campaign.id}-platform-fee`,
              type: "DEPOSIT" as TransactionType,
              amount: feeAmount,
              status: "COMPLETED" as TransactionStatus,
              description: `Platform ücreti: ${campaign.title}`,
              createdAt: campaign.createdAt,
              user: campaign.artist,
            };
          } else if (type === "safetyReserve" && safetyReservePercent > 0) {
            const reserveAmount = (budget * safetyReservePercent) / 100;
            return {
              id: `campaign-${campaign.id}-safety-reserve`,
              type: "DEPOSIT" as TransactionType,
              amount: reserveAmount,
              status: "COMPLETED" as TransactionStatus,
              description: `Güvenlik rezervi: ${campaign.title}`,
              createdAt: campaign.createdAt,
              user: campaign.artist,
            };
          }
          return null;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (type === "totalBank") {
      // Get only artists with their balances
      const artists = await prisma.user.findMany({
        where: {
          role: UserRole.ARTIST,
        },
        select: {
          id: true,
          name: true,
          email: true,
          balance: true,
          role: true,
          createdAt: true,
        },
        orderBy: { balance: "desc" },
      });

      // Create virtual transactions for each artist's balance
      transactions = artists
        .filter((user) => Number(user.balance || 0) > 0)
        .map((user) => ({
          id: `user-balance-${user.id}`,
          type: "DEPOSIT" as TransactionType,
          amount: Number(user.balance || 0),
          status: "COMPLETED" as TransactionStatus,
          description: `Sanatçı bakiyesi: ${user.name || user.email}`,
          createdAt: user.createdAt,
          user: {
            name: user.name,
            email: user.email,
          },
        }));
    }

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction details" },
      { status: 500 }
    );
  }
}

