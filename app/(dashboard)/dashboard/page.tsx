import { requireAuth } from "@/lib/auth-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserRole, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  Music2,
  Video,
  Eye,
  ArrowRight,
  Plus,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Zap
} from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import Link from "next/link";
import { MetricCard } from "@/components/analytics/metric-card";
import { ViewsGrowthChart } from "@/components/analytics/views-growth-chart";
import { groupByDate, calculateCumulative, filterByDateRange, formatTrend } from "@/lib/analytics-utils";
import { redirect } from "next/navigation";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireAuth();

  // Redirect admins to analytics page
  if (user.role === UserRole.ADMIN) {
    redirect("/admin/analytics");
  }

  // --- CREATOR DASHBOARD LOGIC (Primary Focus) ---
  if (user.role === UserRole.CREATOR) {
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, balance: true },
    });

    // 1. Aggregations for High-Level Metrics
    const [
      totalEarningsAgg,
      estimatedEarningsAgg,
      totalViewsAgg,
      submissionStats
    ] = await Promise.all([
      // Total Earnings (Completed Payouts)
      prisma.submission.aggregate({
        where: { creatorId: user.id, campaign: { payoutStatus: "COMPLETED" } },
        _sum: { totalEarnings: true }
      }),
      // Estimated Earnings (Approved but Pending Payout)
      prisma.submission.aggregate({
        where: { creatorId: user.id, status: "APPROVED", campaign: { payoutStatus: "PENDING" } },
        _sum: { estimatedEarnings: true }
      }),
      // Total Views
      prisma.submission.aggregate({
        where: { creatorId: user.id },
        _sum: { lastViewCount: true },
        _count: { id: true }
      }),
      // Stats for Approved Counts
      prisma.submission.aggregate({
        where: { creatorId: user.id, status: "APPROVED" },
        _count: { id: true }
      })
    ]);

    const totalEarnings = Number(totalEarningsAgg._sum.totalEarnings || 0);
    const estimatedEarnings = Number(estimatedEarningsAgg._sum.estimatedEarnings || 0);
    const totalViews = totalViewsAgg._sum.lastViewCount || 0;
    const totalSubmissions = totalViewsAgg._count.id;
    const approvedCount = submissionStats._count.id;

    // 2. Efficiently Fetch Top Videos (Sorted by Earnings)
    // We fetch a small subset to sort in memory correctly, prioritizing actual earnings then estimates
    const topPerformingVideos = await prisma.submission.findMany({
      where: { creatorId: user.id, status: "APPROVED" },
      orderBy: [
        { totalEarnings: 'desc' },
        { estimatedEarnings: 'desc' }
      ],
      take: 5,
      include: {
        campaign: {
          include: {
            song: { select: { title: true, coverImage: true } },
          }
        },
      }
    }).then(submissions => submissions.map(sub => ({
      ...sub,
      earnings: sub.campaign.payoutStatus === "COMPLETED" ? Number(sub.totalEarnings) : Number(sub.estimatedEarnings || 0)
    })).sort((a, b) => b.earnings - a.earnings).slice(0, 3));

    // 3. Chart Data (Fetch only necessary fields)
    const chartSubmissions = await prisma.submission.findMany({
      where: { creatorId: user.id },
      select: { createdAt: true, lastViewCount: true },
      orderBy: { createdAt: 'asc' }
    });

    const viewsData = groupByDate(
      chartSubmissions.map((s) => ({ createdAt: s.createdAt, views: s.lastViewCount || 0 })),
      "createdAt",
      "views"
    );
    const cumulativeViewsData = calculateCumulative(filterByDateRange(viewsData, "date", 30)).map((item: any) => ({
      date: item.date,
      views: item.value,
      cumulative: item.cumulative
    }));

    // 4. Recent Submissions List
    const submissions = await prisma.submission.findMany({
      where: { creatorId: user.id },
      include: {
        campaign: {
          include: {
            song: { select: { title: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    return (
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Genel Bakış</h2>
            <p className="text-zinc-400 mt-1">Performans metriklerin ve kazanç durumun.</p>
          </div>
          <Link href="/dashboard/marketplace">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:scale-105 transition-all">
              <Zap className="mr-2 h-4 w-4" />
              Kampanyaları Keşfet
            </Button>
          </Link>
        </div>

        {/* Highlight Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Revenue Card */}
          <MetricCard
            title="Toplam Kazanç"
            value={formatCurrency(totalEarnings)}
            description="Tamamlanan ödemeler"
            icon={<DollarSign className="h-4 w-4 text-purple-400" />}
            variant="premium"
            className="border-purple-500/20"
          />

          {/* Estimated Revenue */}
          <MetricCard
            title="Öngörülen Kazanç"
            value={formatCurrency(estimatedEarnings)}
            description="Bekleyen ödemeler"
            icon={<Sparkles className="h-4 w-4 text-pink-400" />}
            variant="default"
          />

          {/* Total Views */}
          <MetricCard
            title="Toplam İzlenme"
            value={formatNumber(totalViews)}
            description="Tüm videolarında"
            icon={<Eye className="h-4 w-4 text-cyan-400" />}
            variant="default"
          />

          {/* Videos Count */}
          <MetricCard
            title="Aktif Videolar"
            value={totalSubmissions.toString()}
            description={`${approvedCount} onaylı video`}
            icon={<Video className="h-4 w-4 text-zinc-400" />}
            variant="default"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Chart Section */}
          <div className="lg:col-span-4">
            <ViewsGrowthChart
              data={cumulativeViewsData}
              title="Görüntülenme Analizi"
              description="Son 30 günlük kümülatif büyüme"
              showCumulative={true}
            />
          </div>

          {/* Top Performing Videos */}
          <Card className="lg:col-span-3 bg-white/5 border-white/10 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium text-white">En İyi Videolar</CardTitle>
                <Link href="/dashboard/submissions" className="text-xs text-purple-400 hover:text-purple-300">
                  Tümünü Gör
                </Link>
              </div>
              <CardDescription className="text-zinc-400">En çok kazandıran içerikleriniz</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformingVideos.length > 0 ? (
                  topPerformingVideos.map((video, i) => (
                    <div key={video.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-sm font-bold text-white">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{video.campaign.song.title}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {formatNumber(video.lastViewCount || 0)}
                          </span>
                          <span>•</span>
                          <span>{formatCurrency(video.earnings)}</span>
                        </div>
                      </div>
                      {video.campaign.payoutStatus === "COMPLETED" && (
                        <div className="h-2 w-2 rounded-full bg-green-500" title="Ödendi" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    Henüz veri yok.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity / Submissions List (Simplified) */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-white">Son Gönderiler</CardTitle>
            <CardDescription className="text-zinc-400">Kampanya katılımlarınızın durumu</CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length > 0 ? (
              <div className="space-y-1">
                {submissions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                        <Video className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{sub.campaign.song.title}</p>
                        <p className="text-sm text-zinc-500">{formatDate(sub.createdAt)}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`
                              ${sub.status === 'APPROVED' ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : ''}
                              ${sub.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : ''}
                              ${sub.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : ''}
                           `}>
                      {sub.status === 'APPROVED' ? 'Onaylandı' : sub.status === 'PENDING' ? 'İnceleniyor' : 'Reddedildi'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-500 mb-4">Henüz hiç kampanya gönderiniz yok.</p>
                <Link href="/dashboard/marketplace">
                  <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
                    İlk Kampanyana Katıl
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- ARTIST DASHBOARD LOGIC (Updated Premium Design) ---
  // --- ARTIST DASHBOARD LOGIC (Updated Premium Design) ---
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, balance: true },
  });

  // 1. Aggregations for High-Level Metrics
  const [
    totalSpentAgg,
    activeBudgetAgg,
    totalViewsAgg
  ] = await Promise.all([
    // Total Spent
    prisma.transaction.aggregate({
      where: { userId: user.id, type: TransactionType.SPEND, status: "COMPLETED" },
      _sum: { amount: true }
    }),
    // Active Budget (Remaining budget of active campaigns)
    prisma.campaign.aggregate({
      where: { artistId: user.id, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
      _sum: { remainingBudget: true }
    }),
    // Total Views (Across all campaigns)
    prisma.submission.aggregate({
      where: { campaign: { artistId: user.id } },
      _sum: { lastViewCount: true }
    })
  ]);

  const totalSpent = Number(totalSpentAgg._sum.amount || 0);
  const remainingBudget = Number(activeBudgetAgg._sum.remainingBudget || 0);
  const totalViews = totalViewsAgg._sum.lastViewCount || 0;

  // 2. Efficiently Fetch Active Campaigns List
  const activeCampaigns = await prisma.campaign.findMany({
    where: {
      artistId: user.id,
      status: { in: ["ACTIVE", "PENDING_APPROVAL"] }
    },
    include: {
      song: { select: { title: true, coverImage: true } },
    },
    orderBy: { createdAt: "desc" },
    // Limit to reasonable amount if UI is just a preview, assuming 50 max for now or full list if "Manage" view
    // The previous code mapped them all, let's keep it safe but maybe add a take limit if huge?
    // User requested "Safety" aka backend fetch. Fetching 1000 campaigns is bad. Let's limit to 20 for the dashboard widget.
    take: 20
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // 3. Chart Data (Fetch only necessary fields for aggregations)
  const chartSubmissions = await prisma.submission.findMany({
    where: { campaign: { artistId: user.id } },
    select: { createdAt: true, lastViewCount: true },
    orderBy: { createdAt: 'asc' }
  });

  // Views growth data logic for Artist
  const viewsData = groupByDate(
    chartSubmissions.map((s) => ({ createdAt: s.createdAt, views: s.lastViewCount || 0 })),
    "createdAt",
    "views"
  );
  const cumulativeViewsData = calculateCumulative(filterByDateRange(viewsData, "date", 30)).map((item: any) => ({
    date: item.date,
    views: item.value,
    cumulative: item.cumulative
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-medium text-purple-300 mb-2">
            <Music2 className="w-3 h-3" />
            <span>Sanatçı Paneli</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Hoş geldin, {userData?.name || "Sanatçı"}</h2>
          <p className="text-zinc-400 mt-1">Müziğini tanıtmak için yeni kampanyalar oluştur.</p>
        </div>
        <Link href="/artist/campaigns/new">
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/20 transition-all hover:scale-105">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Kampanya Oluştur
          </Button>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Mevcut Bakiye"
          value={formatCurrency(Number(userData?.balance || 0))}
          icon={<TLIcon className="h-4 w-4 text-purple-400" />}
          variant="premium"
          className="border-purple-500/20"
        />
        <MetricCard
          title="Toplam Harcama"
          value={formatCurrency(totalSpent)}
          icon={<Wallet className="h-4 w-4 text-pink-400" />}
          variant="default"
        />
        <MetricCard
          title="Toplam İzlenme"
          value={formatNumber(totalViews)}
          icon={<Eye className="h-4 w-4 text-cyan-400" />}
          variant="default"
        />
        <MetricCard
          title="Aktif Bütçe"
          value={formatCurrency(remainingBudget)}
          icon={<TrendingUp className="h-4 w-4 text-green-400" />}
          variant="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Main Section: Active Campaigns & Chart (Col Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Campaigns List */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium text-white">Aktif Kampanyalar</CardTitle>
                <CardDescription className="text-zinc-400">Yönetmeniz gereken kampanyalar</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white" asChild>
                <Link href="/artist/campaigns">Tümünü Gör <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {activeCampaigns.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {activeCampaigns.map((campaign) => {
                    const budgetPercent = Math.max(0, Math.min(100, (Number(campaign.remainingBudget) / Number(campaign.totalBudget)) * 100));

                    return (
                      <div key={campaign.id} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-12 w-12 rounded-lg bg-zinc-800 bg-cover bg-center shrink-0 border border-white/10"
                            style={{ backgroundImage: `url(${campaign.song.coverImage || '/placeholder-music.png'})` }}>
                            {!campaign.song.coverImage && <Music2 className="h-6 w-6 text-zinc-600 m-auto mt-3" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium text-white truncate">{campaign.title}</h4>
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                              <span>{campaign.song.title}</span>
                              <span className="text-zinc-600">•</span>
                              <span className={campaign.status === 'ACTIVE' ? "text-green-400" : "text-yellow-400"}>
                                {campaign.status === 'ACTIVE' ? 'Yayında' : 'Onay Bekliyor'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="hidden md:block w-32 lg:w-48">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-zinc-400">Bütçe</span>
                            <span className="text-white">{formatCurrency(Number(campaign.remainingBudget))}</span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                              style={{ width: `${budgetPercent}%` }} />
                          </div>
                        </div>

                        <Link href={`/artist/campaigns/${campaign.id}`}>
                          <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/10 hover:text-white ml-2">
                            Yönet
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="inline-flex h-12 w-12 rounded-lg bg-white/5 items-center justify-center mb-4">
                    <Video className="w-6 h-6 text-zinc-500" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Aktif kampanya yok</h3>
                  <p className="text-zinc-400 text-sm mb-4">Müziğinizi tanıtmak için hemen bir kampanya oluşturun.</p>
                  <Link href="/artist/campaigns/new">
                    <Button size="sm" className="bg-white text-black hover:bg-zinc-200">
                      Kampanya Oluştur
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart */}
          <ViewsGrowthChart
            data={cumulativeViewsData}
            title="Kampanya Performansı"
            description="Son 30 günlük toplam izlenme artışı"
            showCumulative={true}
          />
        </div>

        {/* Side Section: Recent Transactions (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md h-full">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-white">Son İşlemler</CardTitle>
              <CardDescription className="text-zinc-400">Hesap hareketleri</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {transactions.length > 0 ? (
                  transactions.slice(0, 10).map((t, i) => (
                    <div key={t.id} className="flex gap-4 group">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${t.type === 'DEPOSIT' ? 'bg-green-500' : 'bg-pink-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-white line-clamp-1">{t.description || "İşlem"}</p>
                        <p className="text-xs text-zinc-500 mb-1">{formatDate(t.createdAt)}</p>
                        <span className={`text-sm font-medium ${t.type === 'DEPOSIT' ? 'text-green-400' : 'text-zinc-300'}`}>
                          {t.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">Henüz işlem geçmişi yok.</p>
                )}
              </div>

              {transactions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-white/5">
                  <Link href="/wallet">
                    <Button variant="ghost" className="w-full justify-between text-zinc-400 hover:text-white hover:bg-white/5">
                      Cüzdana Git <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
