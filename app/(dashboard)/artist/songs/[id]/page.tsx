import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireArtist } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, formatNumber, cn } from "@/lib/utils";
import { MetricCard } from "@/components/analytics/metric-card";
import {
  ArrowLeft,
  Music2,
  Clock,
  Calendar,
  Target,
  Eye,
  Heart,
  Video,
  TrendingUp,
  BarChart3,
  Plus,
  ExternalLink,
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
      return { label: "İPTAL EDİLDİ", variant: "destructive" as const };
    case "REJECTED":
      return { label: "REDDEDİLDİ", variant: "destructive" as const };
    default:
      return { label: status, variant: "secondary" as const };
  }
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireArtist();

  const song = await prisma.song.findUnique({
    where: { id },
    include: {
      artist: {
        select: { id: true, name: true },
      },
      campaigns: {
        select: {
          id: true,
          title: true,
          status: true,
          totalBudget: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          submissions: {
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
      },
    },
  });

  if (!song || (song.artistId !== user.id && user.role !== "ADMIN")) {
    notFound();
  }

  // =========================================================================
  // AGGREGATE CALCULATIONS
  // =========================================================================

  const totalCampaigns = song.campaigns.length;
  const allSubmissions = song.campaigns.flatMap((c) => c.submissions);
  const totalSubmissions = allSubmissions.length;

  const totalViews = allSubmissions.reduce(
    (sum, s) => sum + s.lastViewCount,
    0
  );
  const totalLikes = allSubmissions.reduce(
    (sum, s) => sum + s.lastLikeCount,
    0
  );
  const totalShares = allSubmissions.reduce(
    (sum, s) => sum + s.lastShareCount,
    0
  );
  const totalComments = allSubmissions.reduce(
    (sum, s) => sum + s.lastCommentCount,
    0
  );

  const activeCampaigns = song.campaigns.filter(
    (c) => c.status === "ACTIVE"
  ).length;

  // Per-campaign summaries
  const campaignSummaries = song.campaigns.map((campaign) => {
    const views = campaign.submissions.reduce(
      (s, sub) => s + sub.lastViewCount,
      0
    );
    const likes = campaign.submissions.reduce(
      (s, sub) => s + sub.lastLikeCount,
      0
    );
    const submissionCount = campaign.submissions.length;
    const approvedCount = campaign.submissions.filter(
      (s) => s.status === "APPROVED"
    ).length;
    return {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      totalBudget: Number(campaign.totalBudget),
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      createdAt: campaign.createdAt,
      views,
      likes,
      submissionCount,
      approvedCount,
    };
  });

  const isTrending = song.videoCount && song.videoCount > 10000;

  // Total budget across all campaigns
  const totalBudgetSpent = campaignSummaries.reduce(
    (sum, c) => sum + c.totalBudget,
    0
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* HERO HEADER                                                       */}
      {/* ================================================================= */}
      <div className="rounded-xl bg-white/[0.02] border border-white/10 backdrop-blur-sm p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Back + Cover + Title */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/artist/songs">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-white/5"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            {song.coverImage ? (
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10">
                <Image
                  src={song.coverImage}
                  alt={song.title}
                  fill
                  className="object-cover"
                  unoptimized={song.coverImage.includes("tiktokcdn")}
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Music2 className="h-6 w-6 text-zinc-500" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-white truncate">
                  {song.title}
                </h1>
                {isTrending && (
                  <Badge variant="default" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Trend
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-400 truncate">
                {song.authorName || song.artist.name}
              </p>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/artist/campaigns/new?songId=${song.id}`}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Kampanya Oluştur
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* KPI METRIC CARDS                                                  */}
      {/* ================================================================= */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Toplam Görüntülenme"
          value={formatNumber(totalViews)}
          description="Tüm kampanyalardan"
          variant="primary"
          icon={<Eye className="h-4 w-4" />}
        />
        <MetricCard
          title="Toplam Beğeni"
          value={formatNumber(totalLikes)}
          description="Tüm kampanyalardan"
          variant="success"
          icon={<Heart className="h-4 w-4" />}
        />
        <MetricCard
          title="Kampanya Sayısı"
          value={totalCampaigns.toString()}
          description={
            activeCampaigns > 0
              ? `${activeCampaigns} aktif kampanya`
              : "Aktif kampanya yok"
          }
          variant="default"
          icon={<Target className="h-4 w-4" />}
        />
        <MetricCard
          title="Oluşturulan Videolar"
          value={formatNumber(totalSubmissions)}
          description={
            song.videoCount
              ? `TikTok: ${formatNumber(song.videoCount)}`
              : "Kampanya gönderimleri"
          }
          variant="warning"
          icon={<Video className="h-4 w-4" />}
        />
      </div>

      {/* ================================================================= */}
      {/* TWO-COLUMN CONTENT                                                */}
      {/* ================================================================= */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2/3: Campaigns List */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Kampanyalar
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Bu şarkı için oluşturulan tüm kampanyalar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignSummaries.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-white/5 p-4 mb-4">
                    <Target className="h-8 w-8 text-zinc-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Henüz kampanya yok
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6 max-w-sm">
                    Bu şarkı için ilk kampanyanızı oluşturun ve içerik
                    üreticilerine ulaşın.
                  </p>
                  <Link href={`/artist/campaigns/new?songId=${song.id}`}>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Kampanya Oluştur
                    </Button>
                  </Link>
                </div>
              ) : (
                /* Campaign List */
                <div className="space-y-3">
                  {campaignSummaries.map((campaign) => {
                    const statusConfig = getStatusConfig(campaign.status);
                    const isActive = campaign.status === "ACTIVE";

                    return (
                      <Link
                        key={campaign.id}
                        href={`/artist/campaigns/${campaign.id}`}
                        className="block"
                      >
                        <div
                          className={cn(
                            "rounded-lg border p-4 transition-all hover:bg-white/5 hover:border-white/20",
                            isActive
                              ? "border-green-500/20 bg-green-500/[0.03]"
                              : "border-white/10 bg-white/[0.02]"
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {/* Left: Title + Status */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-white truncate">
                                  {campaign.title}
                                </h4>
                                <Badge variant={statusConfig.variant}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">
                                {campaign.startDate
                                  ? `${formatDate(campaign.startDate)} — ${campaign.endDate ? formatDate(campaign.endDate) : "Devam ediyor"}`
                                  : `Oluşturulma: ${formatDate(campaign.createdAt)}`}
                              </p>
                            </div>

                            {/* Right: Stats */}
                            <div className="flex items-center gap-4 text-sm shrink-0">
                              <div className="text-center">
                                <p className="font-semibold text-white">
                                  {formatCurrency(campaign.totalBudget)}
                                </p>
                                <p className="text-xs text-zinc-500">Bütçe</p>
                              </div>
                              <Separator
                                orientation="vertical"
                                className="h-8 bg-white/10"
                              />
                              <div className="text-center">
                                <p className="font-semibold text-white">
                                  {formatNumber(campaign.views)}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  Görüntülenme
                                </p>
                              </div>
                              <Separator
                                orientation="vertical"
                                className="h-8 bg-white/10"
                              />
                              <div className="text-center">
                                <p className="font-semibold text-white">
                                  {campaign.approvedCount}/
                                  {campaign.submissionCount}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  Gönderi
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {/* Summary row */}
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">
                        Toplam {totalCampaigns} kampanya
                      </span>
                      <span className="font-semibold text-zinc-300">
                        Toplam Bütçe: {formatCurrency(totalBudgetSpent)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1/3: Song Info Sidebar */}
        <div className="space-y-6">
          {/* Song Info Card */}
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Music2 className="h-4 w-4" />
                Şarkı Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Album Cover */}
              <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-white/10 bg-white/5">
                {song.coverImage ? (
                  <Image
                    src={song.coverImage}
                    alt={song.title}
                    fill
                    className="object-cover"
                    priority
                    unoptimized={song.coverImage.includes("tiktokcdn")}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Music2 className="h-16 w-16 text-zinc-600" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-white line-clamp-1">
                  {song.title}
                </h3>
                <p className="text-sm text-zinc-400">
                  {song.authorName || song.artist.name}
                </p>
                {song.duration !== null && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDuration(song.duration)}</span>
                  </div>
                )}
              </div>

              {song.tiktokUrl && (
                <a
                  href={song.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-white/10 hover:bg-white/5"
                  >
                    <ExternalLink className="h-4 w-4" />
                    TikTok&apos;ta Dinle
                  </Button>
                </a>
              )}

              {/* TikTok Stats */}
              {song.tiktokMusicId && song.videoCount && (
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">TikTok Videoları</span>
                    <span className="font-semibold text-white">
                      {formatNumber(song.videoCount)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                      style={{
                        width: `${Math.min((song.videoCount / 50000) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-zinc-600">
                    {song.videoCount < 1000 && "Başlangıç"}
                    {song.videoCount >= 1000 &&
                      song.videoCount < 10000 &&
                      "Büyüyen"}
                    {song.videoCount >= 10000 &&
                      song.videoCount < 50000 &&
                      "Popüler"}
                    {song.videoCount >= 50000 && "Viral"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata Card */}
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Detaylar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Yüklenme Tarihi</span>
                <span className="font-semibold text-zinc-300">
                  {formatDate(song.createdAt)}
                </span>
              </div>

              {song.statsLastFetched && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Son Güncelleme</span>
                  <span className="font-semibold text-zinc-300">
                    {formatDate(song.statsLastFetched)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Toplam Etkileşim</span>
                <span className="font-semibold text-zinc-300">
                  {formatNumber(
                    totalViews + totalLikes + totalShares + totalComments
                  )}
                </span>
              </div>

              {totalViews > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Etkileşim Oranı</span>
                  <span className="font-semibold text-zinc-300">
                    %
                    {(
                      ((totalLikes + totalShares + totalComments) /
                        totalViews) *
                      100
                    ).toFixed(1)}
                  </span>
                </div>
              )}

              {song.description && (
                <>
                  <Separator className="bg-white/5" />
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Açıklama</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {song.description}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
