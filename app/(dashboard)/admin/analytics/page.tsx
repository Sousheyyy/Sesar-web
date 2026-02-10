import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Video,
  DollarSign,
  Shield,
  Activity
} from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import { TransactionType, TransactionStatus, UserRole } from "@prisma/client";
import { RevenuePayoutsComparison } from "@/components/analytics/revenue-payouts-comparison";
import { ApiCallsChartClient } from "@/components/analytics/api-calls-chart-client";
import { EngagementMetricsChart } from "@/components/analytics/engagement-metrics-chart";
import { TopCampaignsTable } from "@/components/analytics/top-campaigns-table";
import { AlertsSection } from "@/components/analytics/alerts-section";
import { MetricCard } from "@/components/analytics/metric-card";
import { FinancialMetricCard } from "@/components/analytics/financial-metric-card";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { Suspense } from "react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

import {
  groupTransactionsByDate,
  groupEngagementByDate,
} from "@/lib/analytics-utils";

interface AdminAnalyticsPageProps {
  searchParams: { startDate?: string; endDate?: string };
}

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  await requireAdmin();

  // Parse date filters
  const startDate = searchParams.startDate ? new Date(searchParams.startDate) : null;
  const endDate = searchParams.endDate ? new Date(searchParams.endDate) : null;

  // Set end of day for endDate if provided
  const endDateFilter = endDate ? new Date(endDate) : null;
  if (endDateFilter) {
    endDateFilter.setHours(23, 59, 59, 999);
  }

  // Build date filter for queries
  const dateFilter = startDate || endDateFilter ? {
    createdAt: {
      ...(startDate && { gte: startDate }),
      ...(endDateFilter && { lte: endDateFilter }),
    },
  } : {};

  // Execute all queries sequentially to avoid connection pool exhaustion
  // Count queries (filtered by date range if provided)
  const totalUsers = await prisma.user.count({
    where: dateFilter,
  });
  const totalCampaigns = await prisma.campaign.count({
    where: dateFilter,
  });
  const totalSubmissions = await prisma.submission.count({
    where: dateFilter,
  });
  const totalSongs = await prisma.song.count({
    where: dateFilter,
  });
  const pendingTransactionsCount = await prisma.transaction.count({
    where: {
      status: "PENDING",
      type: { in: ["DEPOSIT", "WITHDRAWAL"] },
    },
  });
  const pendingCampaigns = await prisma.campaign.count({
    where: { status: "PENDING_APPROVAL" },
  });
  const pendingTransactionsAmount = await prisma.transaction.aggregate({
    where: {
      status: "PENDING",
      type: { in: ["DEPOSIT", "WITHDRAWAL"] },
    },
    _sum: { amount: true },
  });

  const pendingTransactions = pendingTransactionsCount;

  // Data queries (limit to recent data for charts)
  const users = await prisma.user.findMany({
    where: dateFilter,
    select: {
      id: true,
      role: true,
      balance: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      status: "COMPLETED",
      ...dateFilter,
    },
    select: {
      type: true,
      amount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000, // Limit for chart data
  });

  const campaigns = await prisma.campaign.findMany({
    where: dateFilter,
    select: {
      id: true,
      title: true,
      status: true,
      totalBudget: true,
      commissionPercent: true,
      createdAt: true,
      submissions: {
        where: dateFilter,
        select: {
          lastViewCount: true,
          lastLikeCount: true,
          lastCommentCount: true,
          lastShareCount: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const submissions = await prisma.submission.findMany({
    where: dateFilter,
    select: {
      createdAt: true,
      status: true,
      lastViewCount: true,
      lastLikeCount: true,
      lastCommentCount: true,
      lastShareCount: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000, // Limit for chart data
  });

  // Calculate platform fees and safety reserves from approved campaigns only
  // Only count ACTIVE and COMPLETED campaigns (approved ones)
  const approvedCampaigns = campaigns.filter(
    (c) => c.status === "ACTIVE" || c.status === "COMPLETED"
  );

  const platformFees = approvedCampaigns.reduce((sum, c) => {
    const budget = Number(c.totalBudget) || 0;
    const commission = c.commissionPercent || 20;
    const fee = (budget * commission) / 100;
    return sum + (isNaN(fee) ? 0 : fee);
  }, 0);

  // Revenue = Platform Fees (income from approved campaigns)
  const totalRevenue = platformFees;

  const totalPayouts = transactions
    .filter((t) => t.type === "WITHDRAWAL")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Calculate total bank (sum of all artist balances only)
  const totalBank = users
    .filter((u) => u.role === UserRole.ARTIST)
    .reduce((sum, u) => sum + Number(u.balance || 0), 0);

  const artistCount = users.filter((u) => u.role === UserRole.ARTIST).length;

  // User metrics (kept for potential future use)

  // Campaign metrics
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const completedCampaigns = campaigns.filter((c) => c.status === "COMPLETED").length;
  const totalCampaignBudget = campaigns.reduce(
    (sum, c) => sum + Number(c.totalBudget),
    0
  );


  // Submission metrics
  const approvedSubmissions = submissions.filter((s) => s.status === "APPROVED").length;
  const pendingSubmissions = submissions.filter((s) => s.status === "PENDING").length;
  const rejectedSubmissions = submissions.filter((s) => s.status === "REJECTED").length;

  const totalViews = submissions.reduce((sum, s) => sum + s.lastViewCount, 0);
  const totalLikes = submissions.reduce((sum, s) => sum + s.lastLikeCount, 0);
  const totalComments = submissions.reduce((sum, s) => sum + s.lastCommentCount, 0);
  const totalShares = submissions.reduce((sum, s) => sum + s.lastShareCount, 0);


  // Chart data - Group platform fees by campaign creation date (revenue)
  const revenueDataMap = new Map<string, number>();
  approvedCampaigns.forEach((campaign) => {
    const date = new Date(campaign.createdAt);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const budget = Number(campaign.totalBudget) || 0;
    const commission = campaign.commissionPercent || 20;
    const fee = (budget * commission) / 100;
    if (!isNaN(fee) && fee > 0) {
      revenueDataMap.set(dateKey, (revenueDataMap.get(dateKey) || 0) + fee);
    }
  });

  const revenueData = Array.from(revenueDataMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Group payouts by date
  const payoutsData = groupTransactionsByDate(
    transactions.map(t => ({
      ...t,
      amount: Number(t.amount)
    })),
    "WITHDRAWAL"
  );

  // Combine revenue and payouts for comparison
  // Get all unique dates from both revenue and payouts
  const allDates = new Set<string>();
  revenueData.forEach((item) => allDates.add(item.date));
  payoutsData.forEach((item) => allDates.add(item.date));

  // Create a map for quick lookup
  const revenueMap = new Map<string, number>();
  revenueData.forEach((item) => revenueMap.set(item.date, item.revenue));

  const payoutsMap = new Map<string, number>();
  payoutsData.forEach((item) => payoutsMap.set(item.date, item.revenue));

  // Combine data ensuring all dates are included
  const revenuePayoutsData = Array.from(allDates)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      revenue: revenueMap.get(date) || 0,
      payouts: payoutsMap.get(date) || 0,
    }));

  const engagementData = groupEngagementByDate(submissions);

  // Top campaigns by views
  const topCampaigns = campaigns
    .map((c) => {
      const campaignViews = c.submissions.reduce(
        (sum, s) => sum + s.lastViewCount,
        0
      );
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        totalBudget: Number(c.totalBudget),
        submissions: c.submissions.length,
        totalViews: campaignViews,
        createdAt: c.createdAt,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10);

  // Alerts
  const alerts: Array<{
    id: string;
    type: "warning" | "info" | "error";
    title: string;
    message: string;
    count: number;
    amount?: number;
    link?: string;
    linkText?: string;
  }> = [];
  if (pendingCampaigns > 0) {
    alerts.push({
      id: "pending-campaigns",
      type: "warning" as const,
      title: "Onay Bekleyen Kampanyalar",
      message: `${pendingCampaigns} kampanya onay bekliyor`,
      count: pendingCampaigns,
      link: "/admin/campaigns",
      linkText: "Kampanyaları Görüntüle",
    });
  }

  if (pendingTransactions > 0) {
    alerts.push({
      id: "pending-transactions",
      type: "info" as const,
      title: "Bekleyen İşlemler",
      message: `${pendingTransactions} işlem onay bekliyor`,
      count: pendingTransactions,
      amount: pendingTransactionsAmount._sum.amount ? Number(pendingTransactionsAmount._sum.amount) : undefined,
      link: "/admin/transactions",
      linkText: "İşlemleri Görüntüle",
    });
  }

  if (pendingSubmissions > 10) {
    alerts.push({
      id: "pending-submissions",
      type: "warning" as const,
      title: "Çok Sayıda Bekleyen Gönderi",
      message: `${pendingSubmissions} gönderi onay bekliyor`,
      count: pendingSubmissions,
    });
  }


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 mb-2">
            <Shield className="w-3 h-3" />
            <span>Yönetici Paneli</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Platform Genel Bakış</h2>
          <p className="text-zinc-400 mt-1">Platform sağlığı, finansal durum ve kullanıcı aktiviteleri.</p>
        </div>
        <Suspense fallback={<div className="h-10 w-48 bg-white/5 animate-pulse rounded-lg" />}>
          <DateRangeFilter />
        </Suspense>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Toplam Görüntülenme"
          value={formatNumber(totalViews)}
          description={`${approvedSubmissions} onaylanan gönderi`}
          icon={<Video className="h-4 w-4 text-cyan-400" />}
          variant="default"
        />
        <FinancialMetricCard
          title="Toplam Banka"
          value={formatCurrency(totalBank)}
          description={`${artistCount} sanatçı bakiyesi`}
          icon={<TLIcon className="h-4 w-4 text-emerald-400" />}
          variant="success"
          modalTitle="Toplam Banka Detayları"
          modalType="totalBank"
          totalAmount={totalBank}
          className="border-emerald-500/20"
        />
        <FinancialMetricCard
          title="Toplam Ödemeler"
          value={formatCurrency(totalPayouts)}
          description="Tüm zamanlar"
          icon={<TLIcon className="h-4 w-4 text-red-400" />}
          variant="destructive"
          modalTitle="Toplam Ödemeler Detayları"
          modalType="payouts"
          totalAmount={totalPayouts}
          className="border-red-500/20"
        />
        <FinancialMetricCard
          title="Platform Geliri"
          value={formatCurrency(isNaN(platformFees) ? 0 : platformFees)}
          description="Toplam komisyon"
          icon={<DollarSign className="h-4 w-4 text-purple-400" />}
          variant="premium"
          modalTitle="Platform Geliri Detayları"
          modalType="platformFee"
          totalAmount={isNaN(platformFees) ? 0 : platformFees}
          className="border-purple-500/20"
        />
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && <AlertsSection alerts={alerts} />}

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-white">Gelir ve Gider Analizi</CardTitle>
            <CardDescription className="text-zinc-400">Platform gelirleri vs. Ödemeler</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <RevenuePayoutsComparison data={revenuePayoutsData} />
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-white">Etkileşim Metrikleri</CardTitle>
            <CardDescription className="text-zinc-400">Beğeni, Yorum ve Paylaşım trendleri</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <EngagementMetricsChart data={engagementData} />
          </CardContent>
        </Card>
      </div>

      {/* Top Campaigns & Platform Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopCampaignsTable campaigns={topCampaigns} />
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md h-full">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-white">Platform Sağlığı</CardTitle>
            <CardDescription className="text-zinc-400">Performans göstergeleri</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Kampanya Tamamlanma</span>
                <span className="text-sm font-bold text-white">
                  {totalCampaigns > 0
                    ? Math.round((completedCampaigns / totalCampaigns) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{
                    width: `${totalCampaigns > 0
                      ? (completedCampaigns / totalCampaigns) * 100
                      : 0
                      }%`,
                  }}
                />
              </div>
              <p className="text-xs text-zinc-500">Toplam {totalCampaigns} kampanyadan {completedCampaigns} tanesi tamamlandı.</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Gönderi Onay Oranı</span>
                <span className="text-sm font-bold text-white">
                  {totalSubmissions > 0
                    ? Math.round((approvedSubmissions / totalSubmissions) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                  style={{
                    width: `${totalSubmissions > 0
                      ? (approvedSubmissions / totalSubmissions) * 100
                      : 0
                      }%`,
                  }}
                />
              </div>
              <p className="text-xs text-zinc-500">Toplam {totalSubmissions} gönderiden {approvedSubmissions} tanesi onaylandı.</p>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-3">
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Toplam Etkileşim</h4>
              <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <span className="text-zinc-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-500" /> Beğeni
                </span>
                <span className="font-semibold text-white">{formatNumber(totalLikes)}</span>
              </div>
              <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <span className="text-zinc-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" /> Yorum
                </span>
                <span className="font-semibold text-white">{formatNumber(totalComments)}</span>
              </div>
              <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <span className="text-zinc-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" /> Paylaşım
                </span>
                <span className="font-semibold text-white">{formatNumber(totalShares)}</span>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                <p className="text-xs text-purple-300 mb-1">Ortalama Gönderi Başına İzlenme</p>
                <p className="text-xl font-bold text-white">
                  {approvedSubmissions > 0
                    ? formatNumber(Math.floor(totalViews / approvedSubmissions))
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Health (Bottom) */}
      <div className="grid gap-6">
        <ApiCallsChartClient />
      </div>
    </div>
  );
}
