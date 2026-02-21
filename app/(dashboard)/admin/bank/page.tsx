import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { CampaignStatus, UserRole } from "@prisma/client";
import { BankPageClient } from "@/components/admin/bank-page-client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

// ─── Mock Data Generator ──────────────────────────────────────────

function generateMockData() {
  const TURKISH_MONTHS = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ];

  const mockCampaigns = [
    { title: "Yaz Hiti 2025", budget: 100000, commission: 20, submissions: 22, insurance: false, month: 5 },
    { title: "Rap Battle Challenge", budget: 75000, commission: 20, submissions: 15, insurance: false, month: 6 },
    { title: "Pop Müzik Tanıtımı", budget: 50000, commission: 20, submissions: 8, insurance: false, month: 7 },
    { title: "Underground Vibes", budget: 30000, commission: 20, submissions: 4, insurance: true, month: 7 },
    { title: "Dans Akımı", budget: 45000, commission: 20, submissions: 12, insurance: false, month: 8 },
    { title: "R&B Romantik", budget: 60000, commission: 20, submissions: 10, insurance: false, month: 9 },
    { title: "Festival Canlılığı", budget: 120000, commission: 20, submissions: 28, insurance: false, month: 9 },
    { title: "Akustik Sesleri", budget: 25000, commission: 20, submissions: 2, insurance: true, month: 10 },
    { title: "Elektro Beat", budget: 80000, commission: 20, submissions: 18, insurance: false, month: 11 },
    { title: "Kış Melodisi", budget: 55000, commission: 20, submissions: 9, insurance: false, month: 11 },
    { title: "Yılbaşı Özel", budget: 90000, commission: 20, submissions: 20, insurance: false, month: 12 },
    { title: "Yeni Yıl Partisi", budget: 35000, commission: 20, submissions: 6, insurance: false, month: 0 },
    { title: "Bahar Esintisi", budget: 70000, commission: 20, submissions: 14, insurance: false, month: 1 },
  ];

  let totalBudgets = 0;
  let totalRevenue = 0;
  let totalEarnings = 0;
  let totalRefunds = 0;

  for (const c of mockCampaigns) {
    const comm = (c.budget * c.commission) / 100;
    const net = c.budget - comm;
    totalBudgets += c.budget;
    totalRevenue += comm;
    if (c.insurance) {
      totalRefunds += net;
    } else {
      totalEarnings += net * 0.85;
    }
  }

  const totalNet = totalBudgets - totalRevenue;
  const undistributed = Math.max(0, totalNet - totalEarnings - totalRefunds);

  // Monthly data
  const monthlyMap = new Map<number, { totalBudget: number; commission: number; campaigns: number }>();
  for (const c of mockCampaigns) {
    const existing = monthlyMap.get(c.month) || { totalBudget: 0, commission: 0, campaigns: 0 };
    existing.totalBudget += c.budget;
    existing.commission += (c.budget * c.commission) / 100;
    existing.campaigns += 1;
    monthlyMap.set(c.month, existing);
  }

  const monthlyRevenueData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([monthIdx, val]) => ({
      month: `${TURKISH_MONTHS[monthIdx]} ${monthIdx >= 5 ? 2025 : 2026}`,
      totalBudget: val.totalBudget,
      commission: val.commission,
      campaigns: val.campaigns,
    }));

  // Daily revenue vs payouts (last 90 days, seeded deterministically)
  const revenueVsPayoutsData: { date: string; revenue: number; payouts: number }[] = [];
  const baseDate = new Date(2026, 1, 21); // Feb 21, 2026
  for (let i = 90; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const seed = (i * 7 + 13) % 10;
    const hasRevenue = seed > 6;
    const hasPayouts = seed > 4 || (i % 5 === 0);
    if (hasRevenue || hasPayouts) {
      revenueVsPayoutsData.push({
        date: dateStr,
        revenue: hasRevenue ? 3000 + seed * 2000 : 0,
        payouts: hasPayouts ? 2000 + ((seed * 3 + i) % 8) * 1500 : 0,
      });
    }
  }

  const budgetBreakdown = [
    { name: "Komisyon", value: totalRevenue, fill: "#34d399" },
    { name: "Creator Kazançları", value: totalEarnings, fill: "#3b82f6" },
    { name: "İadeler", value: totalRefunds, fill: "#f87171" },
    { name: "Havuzda Kalan", value: undistributed, fill: "#71717a" },
  ].filter((d) => d.value > 0);

  const topWallets = [
    { id: "m1", name: "Ayşe Kara", email: "ayse@example.com", role: "CREATOR" as UserRole, balance: 12450.50, avatar: null },
    { id: "m2", name: "Mehmet Yılmaz", email: "mehmet@example.com", role: "CREATOR" as UserRole, balance: 8320.00, avatar: null },
    { id: "m3", name: "Zeynep Demir", email: "zeynep@example.com", role: "ARTIST" as UserRole, balance: 6780.25, avatar: null },
    { id: "m4", name: "Can Özkan", email: "can@example.com", role: "CREATOR" as UserRole, balance: 5400.00, avatar: null },
    { id: "m5", name: "Elif Aydın", email: "elif@example.com", role: "CREATOR" as UserRole, balance: 4290.75, avatar: null },
    { id: "m6", name: "Burak Çelik", email: "burak@example.com", role: "ARTIST" as UserRole, balance: 3850.00, avatar: null },
    { id: "m7", name: "Selin Koç", email: "selin@example.com", role: "CREATOR" as UserRole, balance: 2100.50, avatar: null },
    { id: "m8", name: "Emre Arslan", email: "emre@example.com", role: "CREATOR" as UserRole, balance: 1875.00, avatar: null },
  ];

  const totalCreatorBalance = topWallets.filter(w => w.role === "CREATOR").reduce((s, w) => s + w.balance, 0);
  const totalArtistBalance = topWallets.filter(w => w.role === "ARTIST").reduce((s, w) => s + w.balance, 0);

  const allPayouts = mockCampaigns.map((c, i) => {
    const comm = (c.budget * c.commission) / 100;
    const net = c.budget - comm;
    const distributed = c.insurance ? 0 : net * 0.85;
    const d = new Date(2026, 1, 21);
    d.setDate(d.getDate() - i * 8);
    return {
      id: `mock-${i}`,
      title: c.title,
      totalBudget: c.budget,
      commissionPercent: c.commission,
      submissionCount: c.submissions,
      totalDistributed: Math.round(distributed * 100) / 100,
      insuranceTriggered: c.insurance,
      completedAt: d.toISOString(),
    };
  });

  const completedCount = mockCampaigns.length;
  const insuranceCount = mockCampaigns.filter(c => c.insurance).length;

  return {
    kpis: {
      platformRevenue: totalRevenue,
      totalCampaignBudgets: totalBudgets,
      totalNetPrizePool: totalNet,
      campaignCount: mockCampaigns.length,
      totalCreatorEarnings: Math.round(totalEarnings * 100) / 100,
      totalWithdrawals: 18500,
      withdrawalCount: 12,
      pendingWithdrawalsAmount: 3200,
      pendingWithdrawalsCount: 2,
      totalRefunds: Math.round(totalRefunds * 100) / 100,
      totalCreatorBalance,
      creatorWalletCount: topWallets.filter(w => w.role === "CREATOR").length,
      totalArtistBalance,
      artistWalletCount: topWallets.filter(w => w.role === "ARTIST").length,
      totalCompletedCampaigns: completedCount,
      insuranceTriggeredCount: insuranceCount,
      insuranceRate: completedCount > 0 ? (insuranceCount / completedCount) * 100 : 0,
    },
    monthlyRevenueData,
    revenueVsPayoutsData,
    budgetBreakdown,
    topWallets,
    recentCampaignPayouts: allPayouts
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 10),
  };
}

// ─── Main Page ────────────────────────────────────────────────────

interface AdminBankPageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}

export default async function AdminBankPage({ searchParams }: AdminBankPageProps) {
  await requireAdmin();

  const resolvedSearchParams = await searchParams;

  // Parse date filters
  const startDate = resolvedSearchParams.startDate ? new Date(resolvedSearchParams.startDate) : null;
  const endDate = resolvedSearchParams.endDate ? new Date(resolvedSearchParams.endDate) : null;

  const endDateFilter = endDate ? new Date(endDate) : null;
  if (endDateFilter) {
    endDateFilter.setHours(23, 59, 59, 999);
  }

  const dateFilter = startDate || endDateFilter ? {
    createdAt: {
      ...(startDate && { gte: startDate }),
      ...(endDateFilter && { lte: endDateFilter }),
    },
  } : {};

  // ─── Batch 1: Revenue + Payout KPIs (parallelized) ─────────────

  const [revenueCampaigns, earningsAgg, withdrawalsAgg, pendingWithdrawalsAgg, refundsAgg] =
    await Promise.all([
      prisma.campaign.findMany({
        where: {
          status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] },
          ...dateFilter,
        },
        select: {
          id: true,
          title: true,
          totalBudget: true,
          commissionPercent: true,
          status: true,
          createdAt: true,
          completedAt: true,
          insuranceTriggered: true,
          payoutStatus: true,
          _count: { select: { submissions: true } },
        },
      }),
      prisma.transaction.aggregate({
        where: { type: "EARNING", status: "COMPLETED", ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAWAL", status: "COMPLETED", ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAWAL", status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: "REFUND", status: "COMPLETED", ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  let totalCampaignBudgets = 0;
  let platformRevenue = 0;
  for (const c of revenueCampaigns) {
    const budget = Number(c.totalBudget) || 0;
    const commission = c.commissionPercent || 20;
    totalCampaignBudgets += budget;
    platformRevenue += (budget * commission) / 100;
  }
  const totalNetPrizePool = totalCampaignBudgets - platformRevenue;
  const campaignCount = revenueCampaigns.length;
  const totalCreatorEarnings = Number(earningsAgg._sum.amount || 0);
  const totalWithdrawals = Number(withdrawalsAgg._sum.amount || 0);
  const withdrawalCount = withdrawalsAgg._count;
  const pendingWithdrawalsAmount = Number(pendingWithdrawalsAgg._sum.amount || 0);
  const pendingWithdrawalsCount = pendingWithdrawalsAgg._count;
  const totalRefunds = Number(refundsAgg._sum.amount || 0);

  // ─── Batch 2: Wallet Liability (parallelized) ─────────────────

  const [creatorBalanceAgg, artistBalanceAgg, topWallets] = await Promise.all([
    prisma.user.aggregate({
      where: { role: UserRole.CREATOR, balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    }),
    prisma.user.aggregate({
      where: { role: UserRole.ARTIST, balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    }),
    prisma.user.findMany({
      where: { balance: { gt: 0 } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance: true,
        avatar: true,
        tiktokAvatarUrl: true,
      },
      orderBy: { balance: "desc" },
      take: 10,
    }),
  ]);

  const totalCreatorBalance = Number(creatorBalanceAgg._sum.balance || 0);
  const creatorWalletCount = creatorBalanceAgg._count;
  const totalArtistBalance = Number(artistBalanceAgg._sum.balance || 0);
  const artistWalletCount = artistBalanceAgg._count;

  // ─── D. Insurance Stats ─────────────────────────────────────────

  const completedCampaigns = revenueCampaigns.filter(
    (c) => c.status === CampaignStatus.COMPLETED
  );
  const totalCompletedCampaigns = completedCampaigns.length;
  const insuranceTriggeredCount = completedCampaigns.filter(
    (c) => c.insuranceTriggered
  ).length;
  const insuranceRate =
    totalCompletedCampaigns > 0
      ? (insuranceTriggeredCount / totalCompletedCampaigns) * 100
      : 0;

  // ─── E. Monthly Revenue Trend ───────────────────────────────────

  const monthlyMap = new Map<
    string,
    { totalBudget: number; commission: number; campaigns: number }
  >();
  for (const c of revenueCampaigns) {
    const d = new Date(c.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyMap.get(key) || {
      totalBudget: 0,
      commission: 0,
      campaigns: 0,
    };
    const budget = Number(c.totalBudget) || 0;
    const commRate = c.commissionPercent || 20;
    existing.totalBudget += budget;
    existing.commission += (budget * commRate) / 100;
    existing.campaigns += 1;
    monthlyMap.set(key, existing);
  }

  const TURKISH_MONTHS = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ];

  const monthlyRevenueData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [year, month] = key.split("-");
      const monthIdx = parseInt(month) - 1;
      return {
        month: `${TURKISH_MONTHS[monthIdx]} ${year}`,
        totalBudget: val.totalBudget,
        commission: val.commission,
        campaigns: val.campaigns,
      };
    });

  // ─── F. Revenue vs Payouts Daily Comparison ─────────────────────

  const commissionByDate = new Map<string, number>();
  for (const c of revenueCampaigns) {
    const dateKey = new Date(c.createdAt).toISOString().split("T")[0];
    const budget = Number(c.totalBudget) || 0;
    const commRate = c.commissionPercent || 20;
    commissionByDate.set(
      dateKey,
      (commissionByDate.get(dateKey) || 0) + (budget * commRate) / 100
    );
  }

  const earningTransactions = await prisma.transaction.findMany({
    where: { type: "EARNING", status: "COMPLETED", ...dateFilter },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const earningsByDate = new Map<string, number>();
  for (const t of earningTransactions) {
    const dateKey = new Date(t.createdAt).toISOString().split("T")[0];
    earningsByDate.set(
      dateKey,
      (earningsByDate.get(dateKey) || 0) + Number(t.amount)
    );
  }

  const allDates = new Set([
    ...commissionByDate.keys(),
    ...earningsByDate.keys(),
  ]);
  const revenueVsPayoutsData = Array.from(allDates)
    .sort()
    .map((date) => ({
      date,
      revenue: commissionByDate.get(date) || 0,
      payouts: earningsByDate.get(date) || 0,
    }));

  // ─── G. Budget Breakdown (pie) ──────────────────────────────────

  const undistributed = Math.max(
    0,
    totalNetPrizePool - totalCreatorEarnings - totalRefunds
  );

  const budgetBreakdown = [
    { name: "Komisyon", value: platformRevenue, fill: "#34d399" },
    { name: "Creator Kazançları", value: totalCreatorEarnings, fill: "#3b82f6" },
    { name: "İadeler", value: totalRefunds, fill: "#f87171" },
    { name: "Havuzda Kalan", value: undistributed, fill: "#71717a" },
  ].filter((d) => d.value > 0);

  // ─── H. Recent Completed Campaigns ──────────────────────────────

  const recentCompleted = completedCampaigns
    .filter((c) => c.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    )
    .slice(0, 10);

  // Fetch all earning transactions for recent campaigns in ONE query (fixes N+1)
  const recentTitles = recentCompleted.map((c) => c.title);
  const allCampaignEarnings = recentTitles.length > 0
    ? await prisma.transaction.findMany({
        where: {
          type: "EARNING",
          status: "COMPLETED",
          description: { in: recentTitles.map((t) => `Campaign earnings: ${t}`) },
        },
        select: { amount: true, description: true },
      })
    : [];

  // Group earnings by campaign title in memory
  const earningsByTitle = new Map<string, number>();
  for (const tx of allCampaignEarnings) {
    const title = tx.description?.replace("Campaign earnings: ", "") || "";
    earningsByTitle.set(title, (earningsByTitle.get(title) || 0) + Number(tx.amount));
  }

  const recentCampaignPayouts = recentCompleted.map((c) => ({
    id: c.id,
    title: c.title,
    totalBudget: Number(c.totalBudget),
    commissionPercent: c.commissionPercent,
    submissionCount: c._count.submissions,
    totalDistributed: earningsByTitle.get(c.title) || 0,
    insuranceTriggered: c.insuranceTriggered,
    completedAt: c.completedAt!.toISOString(),
  }));

  // ─── Check if we have real data, otherwise use mock ─────────────

  const hasRealData = campaignCount > 0 || totalCreatorEarnings > 0 || totalWithdrawals > 0;

  if (!hasRealData) {
    const mock = generateMockData();
    return <BankPageClient {...mock} useMockData />;
  }

  // ─── Serialize & Pass to Client ─────────────────────────────────

  return (
    <BankPageClient
      kpis={{
        platformRevenue,
        totalCampaignBudgets,
        totalNetPrizePool,
        campaignCount,
        totalCreatorEarnings,
        totalWithdrawals,
        withdrawalCount,
        pendingWithdrawalsAmount,
        pendingWithdrawalsCount,
        totalRefunds,
        totalCreatorBalance,
        creatorWalletCount,
        totalArtistBalance,
        artistWalletCount,
        totalCompletedCampaigns,
        insuranceTriggeredCount,
        insuranceRate,
      }}
      monthlyRevenueData={monthlyRevenueData}
      revenueVsPayoutsData={revenueVsPayoutsData}
      budgetBreakdown={budgetBreakdown}
      topWallets={topWallets.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        balance: Number(u.balance),
        avatar: u.tiktokAvatarUrl || u.avatar || null,
      }))}
      recentCampaignPayouts={recentCampaignPayouts}
    />
  );
}
