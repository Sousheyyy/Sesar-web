import Link from "next/link";
import Image from "next/image";
import { requireArtist } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/analytics/metric-card";
import { TLIcon } from "@/components/icons/tl-icon";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Music2,
  Eye,
  TrendingUp,
  Plus,
  ArrowRight,
  Upload,
  ListMusic,
  FolderOpen,
  Heart,
  MessageCircle,
  Share2,
  Users,
  LayoutDashboard,
} from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

function getStatusConfig(status: string) {
  switch (status) {
    case "ACTIVE":
      return { label: "AKTİF", variant: "success" as const };
    case "COMPLETED":
      return { label: "TAMAMLANDI", variant: "secondary" as const };
    case "CANCELLED":
      return { label: "İPTAL", variant: "destructive" as const };
    case "REJECTED":
      return { label: "REDDEDİLDİ", variant: "destructive" as const };
    default:
      return { label: status, variant: "secondary" as const };
  }
}

export default async function ArtistDashboardPage() {
  const user = await requireArtist();

  // =========================================================================
  // DATA FETCHING — parallelized for performance
  // =========================================================================

  const [
    campaignStatusCounts,
    submissionMetrics,
    recentCampaigns,
    recentSongs,
    totalSongsCount,
  ] = await Promise.all([
    // Query 1: Campaign counts by status (lightweight groupBy)
    prisma.campaign.groupBy({
      by: ["status"],
      where: { artistId: user.id },
      _count: true,
    }),

    // Query 2: Aggregate submission metrics across all artist campaigns (DB-level SUM)
    prisma.submission.aggregate({
      where: { campaign: { artistId: user.id } },
      _sum: {
        lastViewCount: true,
        lastLikeCount: true,
        lastCommentCount: true,
        lastShareCount: true,
      },
      _count: true,
    }),

    // Query 3: Only recent 5 campaigns for display (with submission metrics per campaign)
    prisma.campaign.findMany({
      where: { artistId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        totalBudget: true,
        remainingBudget: true,
        createdAt: true,
        song: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            authorName: true,
          },
        },
        _count: {
          select: { submissions: true },
        },
        submissions: {
          select: {
            lastViewCount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Query 4: Recent songs with campaign counts
    prisma.song.findMany({
      where: { artistId: user.id },
      select: {
        id: true,
        title: true,
        coverImage: true,
        authorName: true,
        videoCount: true,
        _count: {
          select: { campaigns: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),

    // Query 5: Total songs count
    prisma.song.count({
      where: { artistId: user.id },
    }),
  ]);

  // =========================================================================
  // DERIVED COMPUTATIONS (from aggregates)
  // =========================================================================

  const statusMap: Record<string, number> = {};
  for (const row of campaignStatusCounts) statusMap[row.status] = row._count;

  const activeCampaignsCount = statusMap["ACTIVE"] ?? 0;
  const totalCampaignsCount = campaignStatusCounts.reduce((s, r) => s + r._count, 0);

  const metrics = {
    views: submissionMetrics._sum.lastViewCount ?? 0,
    likes: submissionMetrics._sum.lastLikeCount ?? 0,
    comments: submissionMetrics._sum.lastCommentCount ?? 0,
    shares: submissionMetrics._sum.lastShareCount ?? 0,
    submissions: submissionMetrics._count,
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-8">
      {/* ================================================================= */}
      {/* WELCOME HEADER                                                    */}
      {/* ================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-medium text-purple-400 mb-3">
            <LayoutDashboard className="w-3 h-3" />
            Kontrol Paneli
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Hoş geldiniz, {user.name || "Sanatçı"}
          </h2>
          <p className="text-zinc-400 mt-1">
            Hesabınızın genel görünümü ve özet bilgileri.
          </p>
        </div>
        <Link href="/artist/campaigns/new">
          <Button className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-0">
            <Plus className="h-4 w-4" />
            Kampanya Oluştur
          </Button>
        </Link>
      </div>

      {/* KPI METRIC CARDS                                                  */}
      {/* ================================================================= */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Bakiye"
          value={formatCurrency(user.balance)}
          description="Mevcut bakiyeniz"
          icon={<TLIcon className="h-4 w-4" />}
          variant="premium"
        />
        <MetricCard
          title="Toplam Görüntülenme"
          value={formatNumber(metrics.views)}
          description={`${metrics.submissions} video`}
          icon={<Eye className="h-4 w-4" />}
          variant="primary"
        />
        <MetricCard
          title="Aktif Kampanyalar"
          value={activeCampaignsCount.toString()}
          description={`${totalCampaignsCount} toplam`}
          icon={<TrendingUp className="h-4 w-4" />}
          variant="success"
        />
        <MetricCard
          title="Toplam Şarkılar"
          value={totalSongsCount.toString()}
          description="Müzik kütüphaneniz"
          icon={<Music2 className="h-4 w-4" />}
          variant="default"
        />
        <MetricCard
          title="Oluşturulan Videolar"
          value={formatNumber(metrics.submissions)}
          description={`${formatNumber(metrics.likes)} beğeni`}
          icon={<Users className="h-4 w-4" />}
          variant="warning"
        />
      </div>

      {/* ================================================================= */}
      {/* TWO-COLUMN CONTENT                                                */}
      {/* ================================================================= */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2/3: Recent Campaigns */}
        <div className="lg:col-span-2">
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium text-white">
                  Son Kampanyalar
                </CardTitle>
                <CardDescription className="text-zinc-500">
                  En son oluşturduğunuz kampanyalar
                </CardDescription>
              </div>
              {recentCampaigns.length > 0 && (
                <Link href="/artist/campaigns">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                  >
                    Tümünü Gör
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {recentCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-white/5 p-4 mb-4">
                    <FolderOpen className="h-10 w-10 text-zinc-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">
                    Henüz kampanya oluşturmadınız
                  </h3>
                  <p className="text-sm text-zinc-500 text-center mb-6 max-w-sm">
                    Müziğinizi tanıtmaya başlamak için ilk kampanyanızı
                    oluşturun.
                  </p>
                  <Link href="/artist/campaigns/new">
                    <Button className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-0">
                      <Plus className="h-4 w-4" />
                      Kampanya Oluştur
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCampaigns.map((campaign) => {
                    const views = campaign.submissions.reduce(
                      (sum, sub) => sum + (sub.lastViewCount || 0),
                      0
                    );
                    const statusConfig = getStatusConfig(campaign.status);

                    return (
                      <Link
                        key={campaign.id}
                        href={`/artist/campaigns/${campaign.id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-purple-500/20 transition-all duration-200 cursor-pointer group">
                          {/* Cover art */}
                          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                            {campaign.song.coverImage ? (
                              <Image
                                src={campaign.song.coverImage}
                                alt={campaign.song.title}
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized={campaign.song.coverImage.includes(
                                  "tiktokcdn"
                                )}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Music2 className="h-5 w-5 text-zinc-600" />
                              </div>
                            )}
                          </div>

                          {/* Campaign info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                                {campaign.title}
                              </p>
                              <Badge
                                variant={statusConfig.variant}
                                className="shrink-0 text-[10px]"
                              >
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500">
                              {campaign.song.authorName ||
                                campaign.song.title}
                            </p>
                          </div>

                          {/* Stats */}
                          <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-400">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {formatNumber(views)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {campaign._count.submissions}
                            </div>
                          </div>

                          {/* Budget */}
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-white">
                              {formatCurrency(
                                Number(campaign.remainingBudget)
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              / {formatCurrency(Number(campaign.totalBudget))}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1/3: Quick Actions + Recent Songs */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-white">
                Hızlı İşlemler
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Link href="/artist/campaigns/new">
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer group">
                  <Plus className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-zinc-300">
                    Kampanya Oluştur
                  </span>
                </div>
              </Link>
              <Link href="/artist/songs/upload">
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all cursor-pointer group">
                  <Upload className="h-5 w-5 text-zinc-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-zinc-300">
                    Şarkı Yükle
                  </span>
                </div>
              </Link>
              <Link href="/artist/campaigns">
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all cursor-pointer group">
                  <TrendingUp className="h-5 w-5 text-zinc-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-zinc-300">
                    Kampanyalarım
                  </span>
                </div>
              </Link>
              <Link href="/artist/songs">
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all cursor-pointer group">
                  <ListMusic className="h-5 w-5 text-zinc-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-zinc-300">
                    Şarkılarım
                  </span>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Songs */}
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-medium text-white">
                Son Şarkılar
              </CardTitle>
              {recentSongs.length > 0 && (
                <Link href="/artist/songs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs"
                  >
                    Tümünü Gör
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {recentSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Music2 className="h-8 w-8 text-zinc-600 mb-3" />
                  <p className="text-sm text-zinc-500 text-center">
                    Henüz şarkı eklemediniz.
                  </p>
                  <Link href="/artist/songs/upload" className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-400"
                    >
                      Şarkı Yükle
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSongs.map((song) => (
                    <Link key={song.id} href={`/artist/songs/${song.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group">
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                          {song.coverImage ? (
                            <Image
                              src={song.coverImage}
                              alt={song.title}
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized={song.coverImage.includes(
                                "tiktokcdn"
                              )}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Music2 className="h-4 w-4 text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                            {song.title}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {song._count.campaigns} kampanya
                            {song.videoCount
                              ? ` · ${formatNumber(song.videoCount)} video`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================================================================= */}
      {/* ENGAGEMENT SUMMARY BAR (conditional)                              */}
      {/* ================================================================= */}
      {metrics.submissions > 0 && (
        <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                <Eye className="h-5 w-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">Görüntülenme</p>
                  <p className="text-sm font-semibold text-white">
                    {formatNumber(metrics.views)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                <Heart className="h-5 w-5 text-pink-400 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">Beğeni</p>
                  <p className="text-sm font-semibold text-white">
                    {formatNumber(metrics.likes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                <MessageCircle className="h-5 w-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">Yorum</p>
                  <p className="text-sm font-semibold text-white">
                    {formatNumber(metrics.comments)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                <Share2 className="h-5 w-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">Paylaşım</p>
                  <p className="text-sm font-semibold text-white">
                    {formatNumber(metrics.shares)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
