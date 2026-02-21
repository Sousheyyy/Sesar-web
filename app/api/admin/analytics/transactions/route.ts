import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus, UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "revenue" | "payouts" | "platformFee" | "totalBank"

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
          const commissionPercent = campaign.commissionPercent || 20;
          const feeAmount = (budget * commissionPercent) / 100;

          if (feeAmount > 0) {
            return {
              id: `campaign-${campaign.id}-commission`,
              type: "DEPOSIT" as TransactionType,
              amount: feeAmount,
              status: "COMPLETED" as TransactionStatus,
              description: `Komisyon (%${commissionPercent}): ${campaign.title}`,
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
    } else if (type === "platformFee") {
      // Commission breakdown from approved campaigns
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
          const commissionPercent = campaign.commissionPercent || 20;
          const feeAmount = (budget * commissionPercent) / 100;

          if (feeAmount > 0) {
            return {
              id: `campaign-${campaign.id}-commission`,
              type: "DEPOSIT" as TransactionType,
              amount: feeAmount,
              status: "COMPLETED" as TransactionStatus,
              description: `Komisyon (%${commissionPercent}): ${campaign.title}`,
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

