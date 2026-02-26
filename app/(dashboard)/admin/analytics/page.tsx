import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Video,
  DollarSign,
  Shield,
  Users,
  Zap,
  TrendingUp,
  BarChart3,
  Eye,
  Music2,
} from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import { UserRole, CampaignStatus } from "@prisma/client";
import { TopCampaignsTable } from "@/components/analytics/top-campaigns-table";
import { AlertsSection } from "@/components/analytics/alerts-section";
import { FinancialMetricCard } from "@/components/analytics/financial-metric-card";
import { MetricCard } from "@/components/analytics/metric-card";
import { DailyFinancialChart } from "@/components/analytics/daily-financial-chart";
import { DailyContentChart } from "@/components/analytics/daily-content-chart";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { Suspense } from "react";
import { SectionErrorBoundary } from "@/components/admin/section-error-boundary";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

interface AdminAnalyticsPageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
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

  // ─── Batch 1: KPI Aggregates (parallelized) ────────────────────
  const [bankAggregate, payoutsAggregate, activeCampaigns, viewsAggregate, revenueCampaigns] =
    await Promise.all([
      prisma.user.aggregate({
        where: { role: UserRole.ARTIST },
        _sum: { balance: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAWAL", status: "COMPLETED", ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.campaign.findMany({
        where: { status: CampaignStatus.ACTIVE },
        select: { totalBudget: true, commissionPercent: true },
      }),
      prisma.submission.aggregate({
        where: { status: "APPROVED", ...dateFilter },
        _sum: { lastViewCount: true },
        _count: true,
      }),
      prisma.campaign.findMany({
        where: {
          status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] },
          ...dateFilter,
        },
        select: { totalBudget: true, commissionPercent: true },
      }),
    ]);

  const totalBank = Number(bankAggregate._sum.balance || 0);
  const artistCount = bankAggregate._count;
  const totalPayouts = Number(payoutsAggregate._sum.amount || 0);
  const payoutCount = payoutsAggregate._count;
  const activeCampaignsCount = activeCampaigns.length;
  const activePrizePool = activeCampaigns.reduce((sum, c) => {
    const budget = Number(c.totalBudget) || 0;
    const commission = c.commissionPercent || 20;
    return sum + budget * (1 - commission / 100);
  }, 0);
  const totalViews = viewsAggregate._sum.lastViewCount || 0;
  const approvedSubmissionsCount = viewsAggregate._count;
  const platformRevenue = revenueCampaigns.reduce((sum, c) => {
    const budget = Number(c.totalBudget) || 0;
    const commission = c.commissionPercent || 20;
    const fee = (budget * commission) / 100;
    return sum + (isNaN(fee) ? 0 : fee);
  }, 0);

  // ─── Batch 2: Counts + Alerts (parallelized) ──────────────────
  const [authenticatedCreators, authenticatedArtists, pendingTransactionsData, pendingSubmissionsCount] =
    await Promise.all([
      prisma.user.count({ where: { role: UserRole.CREATOR } }),
      prisma.user.count({ where: { role: UserRole.ARTIST } }),
      prisma.transaction.aggregate({
        where: { status: "PENDING", type: { in: ["DEPOSIT", "WITHDRAWAL"] } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.submission.count({ where: { status: "PENDING", ...dateFilter } }),
    ]);

  // ─── Batch 3: Chart Data (parallelized) ────────────────────────
  const [campaigns, transactions, submissions] = await Promise.all([
    prisma.campaign.findMany({
      where: dateFilter,
      select: {
        id: true,
        title: true,
        status: true,
        totalBudget: true,
        commissionPercent: true,
        createdAt: true,
        submissions: {
          select: { lastViewCount: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { status: "COMPLETED", type: "WITHDRAWAL", ...dateFilter },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.submission.findMany({
      where: dateFilter,
      select: {
        createdAt: true,
        campaignId: true,
        lastViewCount: true,
        lastLikeCount: true,
        lastShareCount: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  // ─── Chart 1: Daily Financial Data ───────────────────────────────

  // Group campaigns by creation date
  const campaignsByDate = new Map<string, { count: number; budget: number; commission: number }>();
  campaigns.forEach((c) => {
    const dateKey = new Date(c.createdAt).toISOString().split("T")[0];
    const existing = campaignsByDate.get(dateKey) || { count: 0, budget: 0, commission: 0 };
    const budget = Number(c.totalBudget) || 0;
    const commissionRate = c.commissionPercent || 20;
    existing.count += 1;
    existing.budget += budget;
    existing.commission += (budget * commissionRate) / 100;
    campaignsByDate.set(dateKey, existing);
  });

  // Group payouts by date
  const payoutsByDate = new Map<string, number>();
  transactions.forEach((t) => {
    const dateKey = new Date(t.createdAt).toISOString().split("T")[0];
    payoutsByDate.set(dateKey, (payoutsByDate.get(dateKey) || 0) + Number(t.amount));
  });

  // Combine into a single timeline
  const financialDates = new Set([...campaignsByDate.keys(), ...payoutsByDate.keys()]);
  const financialChartData = Array.from(financialDates)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      dateLabel: new Date(date).toLocaleDateString("tr-TR", { month: "short", day: "numeric" }),
      campaignCount: campaignsByDate.get(date)?.count || 0,
      totalBudget: campaignsByDate.get(date)?.budget || 0,
      commission: campaignsByDate.get(date)?.commission || 0,
      payouts: payoutsByDate.get(date) || 0,
    }));

  // ─── Chart 2: Daily Content Data ─────────────────────────────────

  const submissionsByDate = new Map<string, {
    count: number;
    views: number;
    likes: number;
    shares: number;
    campaignIds: Set<string>;
  }>();
  submissions.forEach((s) => {
    const dateKey = new Date(s.createdAt).toISOString().split("T")[0];
    const existing = submissionsByDate.get(dateKey) || {
      count: 0, views: 0, likes: 0, shares: 0, campaignIds: new Set<string>(),
    };
    existing.count += 1;
    existing.views += s.lastViewCount || 0;
    existing.likes += s.lastLikeCount || 0;
    existing.shares += s.lastShareCount || 0;
    if (s.campaignId) existing.campaignIds.add(s.campaignId);
    submissionsByDate.set(dateKey, existing);
  });

  const contentChartData = Array.from(submissionsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      dateLabel: new Date(date).toLocaleDateString("tr-TR", { month: "short", day: "numeric" }),
      campaignCount: d.campaignIds.size,
      submissions: d.count,
      views: d.views,
      likes: d.likes,
      shares: d.shares,
    }));

  // ─── Top Campaigns ───────────────────────────────────────────────

  const topCampaigns = campaigns
    .map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      totalBudget: Number(c.totalBudget),
      submissions: c.submissions.length,
      totalViews: c.submissions.reduce((sum, s) => sum + s.lastViewCount, 0),
      createdAt: c.createdAt,
    }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 8);

  // ─── Alerts ──────────────────────────────────────────────────────

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

  if (pendingTransactionsData._count > 0) {
    alerts.push({
      id: "pending-transactions",
      type: "info",
      title: "Bekleyen İşlemler",
      message: `${pendingTransactionsData._count} işlem onay bekliyor`,
      count: pendingTransactionsData._count,
      amount: pendingTransactionsData._sum.amount ? Number(pendingTransactionsData._sum.amount) : undefined,
      link: "/admin/transactions",
      linkText: "İşlemleri Gör",
    });
  }

  if (pendingSubmissionsCount > 10) {
    alerts.push({
      id: "pending-submissions",
      type: "warning",
      title: "Çok Sayıda Bekleyen Gönderi",
      message: `${pendingSubmissionsCount} gönderi onay bekliyor`,
      count: pendingSubmissionsCount,
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 mb-2">
            <Shield className="w-3 h-3" />
            <span>Yönetici Paneli</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Platform Analitik</h2>
          <p className="text-zinc-400 mt-1">Finansal durum, kampanya performansı ve kullanıcı aktiviteleri</p>
        </div>
        <Suspense fallback={<div className="h-10 w-48 bg-white/5 animate-pulse rounded-lg" />}>
          <DateRangeFilter />
        </Suspense>
      </div>

      {/* ─── KPI Cards (5) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
          description={`${payoutCount} ödeme`}
          icon={<TLIcon className="h-4 w-4 text-red-400" />}
          variant="destructive"
          modalTitle="Ödeme Detayları"
          modalType="payouts"
          totalAmount={totalPayouts}
          className="border-red-500/20"
        />
        <FinancialMetricCard
          title="Platform Geliri"
          value={formatCurrency(isNaN(platformRevenue) ? 0 : platformRevenue)}
          description="Toplam komisyon"
          icon={<DollarSign className="h-4 w-4 text-purple-400" />}
          variant="premium"
          modalTitle="Platform Geliri Detayları"
          modalType="platformFee"
          totalAmount={isNaN(platformRevenue) ? 0 : platformRevenue}
          className="border-purple-500/20"
        />
        <MetricCard
          title="Aktif Kampanyalar"
          value={activeCampaignsCount}
          description={formatCurrency(activePrizePool) + " ödül havuzu"}
          icon={<Zap className="h-4 w-4 text-yellow-400" />}
          variant="warning"
        />
        <MetricCard
          title="Toplam Görüntülenme"
          value={formatNumber(totalViews)}
          description={`${approvedSubmissionsCount} onaylı gönderi`}
          icon={<Video className="h-4 w-4 text-cyan-400" />}
          variant="default"
        />
      </div>

      {/* ─── Alerts ─────────────────────────────────────────────── */}
      {alerts.length > 0 && <AlertsSection alerts={alerts} />}

      {/* ─── Chart 1: Daily Financial ───────────────────────────── */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-lg font-medium text-white">Günlük Finansal Özet</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Oluşturulan kampanyaların toplam bütçesi, komisyon geliri ve ödemeler
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <SectionErrorBoundary>
            <DailyFinancialChart data={financialChartData} />
          </SectionErrorBoundary>
        </CardContent>
      </Card>

      {/* ─── Chart 2: Daily Content ─────────────────────────────── */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <CardTitle className="text-lg font-medium text-white">Günlük İçerik Performansı</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Günlük gönderiler, görüntülenme, beğeni ve paylaşım istatistikleri
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <SectionErrorBoundary>
            <DailyContentChart data={contentChartData} />
          </SectionErrorBoundary>
        </CardContent>
      </Card>

      {/* ─── Top Campaigns & User Stats ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-yellow-400" />
              <CardTitle className="text-lg font-medium text-white">En İyi Kampanyalar</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">En yüksek görüntülenmeye sahip kampanyalar</CardDescription>
          </CardHeader>
          <CardContent>
            <SectionErrorBoundary>
              <TopCampaignsTable campaigns={topCampaigns} maxItems={8} />
            </SectionErrorBoundary>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-lg font-medium text-white">Kayıtlı Kullanıcılar</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">Platformdaki toplam kullanıcı sayıları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Creator Card */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/20">
                  <Eye className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Creator</p>
                  <p className="text-2xl font-bold text-white">{authenticatedCreators.toLocaleString("tr-TR")}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500">Kayıtlı ve aktif içerik üreticileri</p>
            </div>

            {/* Artist Card */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/20">
                  <Music2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Sanatçı</p>
                  <p className="text-2xl font-bold text-white">{authenticatedArtists.toLocaleString("tr-TR")}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500">Kayıtlı ve kampanya oluşturabilen sanatçılar</p>
            </div>

            {/* Total */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
                  <Users className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Toplam</p>
                  <p className="text-2xl font-bold text-white">{(authenticatedCreators + authenticatedArtists).toLocaleString("tr-TR")}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  {authenticatedCreators > 0 && authenticatedArtists > 0
                    ? `${Math.round((authenticatedCreators / (authenticatedCreators + authenticatedArtists)) * 100)}% Creator`
                    : "Creator"
                  }
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  {authenticatedCreators > 0 && authenticatedArtists > 0
                    ? `${Math.round((authenticatedArtists / (authenticatedCreators + authenticatedArtists)) * 100)}% Sanatçı`
                    : "Sanatçı"
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
