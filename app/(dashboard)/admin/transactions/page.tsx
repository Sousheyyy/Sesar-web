import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TransactionsPageClient } from "@/components/admin/transactions-page-client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  await requireAdmin();

  // Compute summary stats with aggregates (fast — no full table scan)
  const [statusCounts, typeSums, typeCountRows] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      _count: true,
    }),
  ]);

  const total = statusCounts.reduce((s, r) => s + r._count, 0);
  const pending = statusCounts.find((r) => r.status === "PENDING")?._count ?? 0;
  const completed = statusCounts.find((r) => r.status === "COMPLETED")?._count ?? 0;
  const rejected = statusCounts.find((r) => r.status === "REJECTED")?._count ?? 0;

  const sumByType = (type: string) =>
    Number(typeSums.find((r) => r.type === type)?._sum?.amount ?? 0);

  const stats = {
    total,
    pending,
    completed,
    rejected,
    totalDeposits: sumByType("DEPOSIT"),
    totalWithdrawals: sumByType("WITHDRAWAL"),
    totalEarnings: sumByType("EARNING"),
    totalSpend: sumByType("SPEND"),
    totalRefunds: sumByType("REFUND"),
  };

  // Type counts for filter cards
  const typeCounts: Record<string, number> = {};
  for (const row of typeCountRows) {
    typeCounts[row.type] = row._count;
  }

  const statusCountsMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusCountsMap[row.status] = row._count;
  }

  // Campaign Payouts — earning transactions grouped by campaign title
  const earningTransactions = await prisma.transaction.findMany({
    where: { type: "EARNING", status: "COMPLETED" },
    select: {
      amount: true,
      description: true,
      createdAt: true,
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const campaignPayoutMap = new Map<
    string,
    {
      campaignTitle: string;
      totalPayout: number;
      creatorCount: number;
      creators: { name: string; email: string; amount: number; date: string }[];
      latestDate: string;
    }
  >();

  for (const t of earningTransactions) {
    const amount = Number(t.amount);
    const date = t.createdAt.toISOString();
    const match = t.description?.match(/^Campaign earnings:\s*(.+)$/);
    const key = match?.[1] ?? t.description ?? "Bilinmeyen Kampanya";

    const existing = campaignPayoutMap.get(key);
    if (existing) {
      existing.totalPayout += amount;
      existing.creatorCount += 1;
      existing.creators.push({
        name: t.user.name || t.user.email,
        email: t.user.email,
        amount,
        date,
      });
      if (date > existing.latestDate) existing.latestDate = date;
    } else {
      campaignPayoutMap.set(key, {
        campaignTitle: key,
        totalPayout: amount,
        creatorCount: 1,
        creators: [
          {
            name: t.user.name || t.user.email,
            email: t.user.email,
            amount,
            date,
          },
        ],
        latestDate: date,
      });
    }
  }

  const campaignPayouts = Array.from(campaignPayoutMap.values()).sort(
    (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );

  return (
    <TransactionsPageClient
      stats={stats}
      typeCounts={typeCounts}
      statusCounts={statusCountsMap}
      campaignPayouts={campaignPayouts}
    />
  );
}
