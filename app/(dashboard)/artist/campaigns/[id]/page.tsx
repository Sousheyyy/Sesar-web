import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireArtist } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, formatNumber, cn } from "@/lib/utils";
import {
  ArrowLeft,
  Music2,
  Clock,
  Calendar,
  Target,
  Zap,
  Info,
  Eye,
  Users,
  Activity,
  TrendingUp,
  BarChart3,
  Heart,
  Share2,
} from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import { MetricCard } from "@/components/analytics/metric-card";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { SubmissionsTable } from "@/components/submissions/submissions-table";
import { CalculationService } from "@/server/services/calculationService";

// New detail components
import { CampaignDetailTabs } from "@/components/campaigns/detail/campaign-detail-tabs";
import { CampaignHealthCard } from "@/components/campaigns/detail/campaign-health-card";
import { EngagementLinesChart } from "@/components/campaigns/detail/engagement-lines-chart";
import { EngagementBreakdownChart } from "@/components/campaigns/detail/engagement-breakdown-chart";
import { CreatorContributionChart } from "@/components/campaigns/detail/creator-contribution-chart";
import { SubmissionMetricsChart } from "@/components/campaigns/detail/submission-metrics-chart";
import { TopCreatorsCard } from "@/components/campaigns/detail/top-creators-card";
import { CampaignTimeline } from "@/components/campaigns/detail/campaign-timeline";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

// --- Status badge helper ---
function getStatusConfig(status: string) {
  switch (status) {
    case "ACTIVE":
      return { label: "AKTİF", variant: "success" as const };
    case "COMPLETED":
      return { label: "TAMAMLANDI", variant: "secondary" as const };
    default:
      return { label: status, variant: "secondary" as const };
  }
}

// --- Duration formatter ---
function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireArtist();

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          duration: true,
          coverImage: true,
          tiktokUrl: true,
          tiktokMusicId: true,
          videoCount: true,
          authorName: true,
          statsLastFetched: true,
          artistId: true,
        },
      },
      artist: {
        select: {
          id: true,
          name: true,
        },
      },
      submissions: {
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              tiktokHandle: true,
              avatar: true,
              followerCount: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!campaign || (campaign.artistId !== user.id && user.role !== "ADMIN")) {
    notFound();
  }

  // =========================================================================
  // DATA TRANSFORMATIONS
  // =========================================================================

  const approvedCount = campaign.submissions.filter(s => s.status === "APPROVED").length;
  const pendingCount = campaign.submissions.filter(s => s.status === "PENDING").length;
  const rejectedCount = campaign.submissions.filter(s => s.status === "REJECTED").length;
  const totalSubmissions = campaign.submissions.length;

  // Aggregate metrics
  const totalViews = campaign.submissions.reduce((s, sub) => s + sub.lastViewCount, 0);
  const totalLikes = campaign.submissions.reduce((s, sub) => s + sub.lastLikeCount, 0);
  const totalShares = campaign.submissions.reduce((s, sub) => s + sub.lastShareCount, 0);
  const totalComments = campaign.submissions.reduce((s, sub) => s + sub.lastCommentCount, 0);

  // Budget calculations
  const totalBudget = Number(campaign.totalBudget);
  const commissionPercent = campaign.commissionPercent || 20;
  const commissionAmount = (totalBudget * commissionPercent) / 100;
  const creatorPool = totalBudget - commissionAmount;

  // Engagement rate
  const engagementRate = totalViews > 0
    ? ((totalLikes + totalShares + totalComments) / totalViews) * 100
    : 0;

  // Points breakdown
  const totalViewPoints = campaign.submissions.reduce((s, sub) => s + sub.lastViewCount * 0.01, 0);
  const totalLikePoints = campaign.submissions.reduce((s, sub) => s + sub.lastLikeCount * 0.5, 0);
  const totalSharePoints = campaign.submissions.reduce((s, sub) => s + sub.lastShareCount * 1.0, 0);
  const totalCampaignScore = totalViewPoints + totalLikePoints + totalSharePoints;

  // Averages
  const avgViewsPerSubmission = approvedCount > 0 ? Math.round(totalViews / approvedCount) : 0;
  const avgLikesPerSubmission = approvedCount > 0 ? Math.round(totalLikes / approvedCount) : 0;
  const avgSharesPerSubmission = approvedCount > 0 ? Math.round(totalShares / approvedCount) : 0;
  const avgPointsPerSubmission = approvedCount > 0 ? Math.round(totalCampaignScore / approvedCount) : 0;

  // Average follower count per unique creator
  const uniqueCreatorMap = new Map<string, number>();
  for (const sub of campaign.submissions) {
    if (!uniqueCreatorMap.has(sub.creatorId)) {
      uniqueCreatorMap.set(sub.creatorId, sub.creator.followerCount || 0);
    }
  }
  const avgFollowerCount =
    uniqueCreatorMap.size > 0
      ? Math.round(
          Array.from(uniqueCreatorMap.values()).reduce((a, b) => a + b, 0) /
            uniqueCreatorMap.size
        )
      : 0;

  // Campaign progress
  const now = new Date();
  const start = campaign.startDate ? new Date(campaign.startDate) : null;
  const end = campaign.endDate ? new Date(campaign.endDate) : null;
  const totalDurationMs = start && end
    ? end.getTime() - start.getTime()
    : (campaign.durationDays || 7) * 86400000;
  const elapsedMs = start ? Math.max(now.getTime() - start.getTime(), 0) : 0;
  const progressPercent = campaign.status === "COMPLETED" ? 100
    : start ? Math.min((elapsedMs / totalDurationMs) * 100, 100) : 0;
  const daysRemaining = end ? Math.max(Math.ceil((end.getTime() - now.getTime()) / 86400000), 0) : null;

  // Insurance health
  const thresholds = CalculationService.getInsuranceThresholds(totalBudget);
  const insuranceCheck = CalculationService.checkInsuranceThresholds(
    totalBudget, approvedCount, totalViews
  );

  // ROI metrics
  const viewsPerTL = totalBudget > 0 ? totalViews / totalBudget : 0;
  const engagementPerTL = totalBudget > 0
    ? (totalLikes + totalShares + totalComments) / totalBudget
    : 0;

  // --- Impact Score & Robin Hood Cap Logic ---
  const submissionScores = campaign.submissions.map(sub => {
    const views = sub.lastViewCount || 0;
    const likes = sub.lastLikeCount || 0;
    const shares = sub.lastShareCount || 0;
    const score = views * 0.01 + likes * 0.5 + shares * 1.0;
    return {
      ...sub,
      score,
      totalEarnings: Number(sub.totalEarnings),
      estimatedEarnings: Number(sub.estimatedEarnings),
      payoutAmount: sub.payoutAmount ? Number(sub.payoutAmount) : null,
    };
  });

  const submissionsWithInitialShare = submissionScores.map(sub => {
    const rawShare = totalCampaignScore > 0 ? sub.score / totalCampaignScore : 0;
    const isCapped = rawShare > 0.4;
    return { ...sub, rawShare, isCapped };
  });

  const cappedPoolAmount = creatorPool * 0.4;
  const finalSubmissions = submissionsWithInitialShare.map(sub => ({
    ...sub,
    calculatedEarnings: sub.isCapped ? cappedPoolAmount : 0,
    contributionPercent: totalCampaignScore > 0
      ? (sub.score / totalCampaignScore) * 100
      : 0,
  }));

  const usedPool = finalSubmissions.reduce((acc, sub) => acc + sub.calculatedEarnings, 0);
  const distributableRemainder = creatorPool - usedPool;
  const nonCappedScore = finalSubmissions
    .filter(sub => !sub.isCapped)
    .reduce((acc, sub) => acc + sub.score, 0);

  const fullyCalculatedSubmissions = finalSubmissions.map(sub => {
    if (sub.calculatedEarnings > 0) {
      return { ...sub, estimatedEarnings: sub.calculatedEarnings };
    }
    const shareOfRemainder = nonCappedScore > 0 ? sub.score / nonCappedScore : 0;
    return { ...sub, estimatedEarnings: shareOfRemainder * distributableRemainder };
  });

  const formattedSubmissions = fullyCalculatedSubmissions.map(sub => ({
    ...sub,
    totalEarnings: sub.totalEarnings > 0 ? sub.totalEarnings : sub.estimatedEarnings,
    estimatedEarnings: sub.estimatedEarnings,
    contributionPercent: sub.contributionPercent,
    contributionPoints: sub.score,
  }));

  // --- Derived data for components ---
  const topCreators = [...formattedSubmissions]
    .sort((a, b) => (b.contributionPoints || 0) - (a.contributionPoints || 0))
    .slice(0, 5)
    .map(sub => ({
      name: sub.creator.name || "İsimsiz",
      handle: sub.creator.tiktokHandle,
      avatar: sub.creator.avatar,
      points: sub.contributionPoints || 0,
      sharePercent: sub.contributionPercent || 0,
      estimatedEarnings: Number(sub.estimatedEarnings) || 0,
    }));

  const creatorChartData = formattedSubmissions
    .filter(sub => sub.status === "APPROVED")
    .map(sub => ({
      name: sub.creator.name || sub.creator.tiktokHandle || "İsimsiz",
      sharePercent: sub.contributionPercent || 0,
      points: sub.contributionPoints || 0,
      earnings: Number(sub.estimatedEarnings) || 0,
      isCapped: sub.isCapped || false,
    }));

  const submissionMetrics = formattedSubmissions
    .filter(sub => sub.status === "APPROVED")
    .map(sub => {
      const views = sub.lastViewCount || 0;
      const likes = sub.lastLikeCount || 0;
      const shares = sub.lastShareCount || 0;
      const comments = sub.lastCommentCount || 0;
      const er = views > 0 ? ((likes + shares + comments) / views) * 100 : 0;
      return {
        creatorName: sub.creator.name || sub.creator.tiktokHandle || "İsimsiz",
        views,
        likes,
        shares,
        engagementRate: Math.round(er * 100) / 100,
        points: sub.contributionPoints || 0,
      };
    });

  // Engagement lines chart data (per creator)
  const engagementLinesData = formattedSubmissions
    .filter(sub => sub.status === "APPROVED")
    .sort((a, b) => (b.lastViewCount || 0) - (a.lastViewCount || 0))
    .slice(0, 20)
    .map(sub => ({
      name: sub.creator.name || sub.creator.tiktokHandle || "İsimsiz",
      views: sub.lastViewCount || 0,
      likes: sub.lastLikeCount || 0,
      shares: sub.lastShareCount || 0,
    }));

  const statusConfig = getStatusConfig(campaign.status);
  const showAnalytics = ["ACTIVE", "COMPLETED"].includes(campaign.status);
  const showHealth = ["ACTIVE", "COMPLETED"].includes(campaign.status);
  const showProgress = !!start;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* HERO HEADER                                                       */}
      {/* ================================================================= */}
      <div className="rounded-xl bg-white/[0.02] border border-white/10 backdrop-blur-sm p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Back + Song cover + Title */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/artist/campaigns">
              <Button variant="ghost" size="icon" className="shrink-0 hover:bg-white/5">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            {campaign.song.coverImage ? (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
                <Image
                  src={campaign.song.coverImage}
                  alt={campaign.song.title}
                  fill
                  className="object-cover"
                  unoptimized={campaign.song.coverImage.includes("tiktokcdn")}
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Music2 className="h-5 w-5 text-zinc-500" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-white truncate">
                  {campaign.title}
                </h1>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
              <p className="text-sm text-zinc-400 truncate">
                {campaign.song.title} &middot; {campaign.song.authorName || campaign.artist.name}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <CampaignActions campaignId={campaign.id} currentStatus={campaign.status} />
          </div>
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-zinc-500">
                {campaign.status === "COMPLETED"
                  ? "Kampanya tamamlandı"
                  : "Kampanya ilerlemesi"
                }
              </span>
              <span className="text-zinc-400 font-medium">
                {campaign.status === "COMPLETED"
                  ? "100%"
                  : daysRemaining !== null
                  ? daysRemaining > 0
                    ? `${daysRemaining} gün kaldı`
                    : "Süre doldu"
                  : `${campaign.durationDays || 7} gün`
                }
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  campaign.status === "COMPLETED"
                    ? "bg-gradient-to-r from-green-500 to-emerald-400"
                    : "bg-gradient-to-r from-purple-500 to-pink-500"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* KPI METRIC CARDS                                                  */}
      {/* ================================================================= */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Toplam Bütçe"
          value={formatCurrency(totalBudget)}
          description={`Dağıtılabilir: ${formatCurrency(creatorPool)}`}
          variant="premium"
          icon={<TLIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Görüntülenme"
          value={formatNumber(totalViews)}
          description={approvedCount > 0 ? `Ort: ${formatNumber(avgViewsPerSubmission)}/gönderi` : "Henüz gönderi yok"}
          variant="primary"
          icon={<Eye className="h-4 w-4" />}
        />
        <MetricCard
          title="Gönderiler"
          value={`${approvedCount}/${totalSubmissions}`}
          description={pendingCount > 0 ? `${pendingCount} beklemede` : rejectedCount > 0 ? `${rejectedCount} reddedildi` : "Tüm gönderiler onaylı"}
          variant="success"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Toplam Puan"
          value={`${formatNumber(totalCampaignScore)} tp`}
          description={approvedCount > 0 ? `Ort: ${formatNumber(avgPointsPerSubmission)} tp` : "Henüz puan yok"}
          variant="default"
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* ================================================================= */}
      {/* AVERAGE STATS                                                     */}
      {/* ================================================================= */}
      {approvedCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-zinc-500">Ort. Takipçi</span>
            </div>
            <p className="text-lg font-bold text-white">
              {formatNumber(avgFollowerCount)}
            </p>
            <p className="text-[11px] text-zinc-600">
              {uniqueCreatorMap.size} benzersiz creator
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs text-zinc-500">Ort. İzlenme</span>
            </div>
            <p className="text-lg font-bold text-white">
              {formatNumber(avgViewsPerSubmission)}
            </p>
            <p className="text-[11px] text-zinc-600">gönderi başına</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-xs text-zinc-500">Ort. Beğeni</span>
            </div>
            <p className="text-lg font-bold text-white">
              {formatNumber(avgLikesPerSubmission)}
            </p>
            <p className="text-[11px] text-zinc-600">gönderi başına</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-zinc-500">Ort. Paylaşım</span>
            </div>
            <p className="text-lg font-bold text-white">
              {formatNumber(avgSharesPerSubmission)}
            </p>
            <p className="text-[11px] text-zinc-600">gönderi başına</p>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TABBED CONTENT                                                    */}
      {/* ================================================================= */}
      <CampaignDetailTabs
        submissionCount={totalSubmissions}
        showAnalytics={showAnalytics}
        overviewContent={
          /* ============================================================= */
          /* TAB: GENEL BAKIS (Overview)                                   */
          /* ============================================================= */
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2/3 */}
            <div className="lg:col-span-2 space-y-6">
              {/* Campaign Health */}
              {showHealth && (
                <CampaignHealthCard
                  insurancePassed={insuranceCheck.passed}
                  submissionProgress={{ current: approvedCount, required: thresholds.minSubmissions }}
                  pointsProgress={{ current: Math.round(totalCampaignScore), required: thresholds.minViews }}
                  viewsProgress={{ current: totalViews, required: thresholds.minViews }}
                  status={campaign.status}
                />
              )}

              {/* Engagement Metrics Line Chart */}
              <EngagementLinesChart data={engagementLinesData} />

              {/* Top Creators */}
              <TopCreatorsCard creators={topCreators} />
            </div>

            {/* Right 1/3 */}
            <div className="space-y-6">
              {/* Song Info */}
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
                    {campaign.song.coverImage ? (
                      <Image
                        src={campaign.song.coverImage}
                        alt={campaign.song.title}
                        fill
                        className="object-cover"
                        priority
                        unoptimized={campaign.song.coverImage.includes("tiktokcdn")}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Music2 className="h-16 w-16 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-white line-clamp-1">{campaign.song.title}</h3>
                    <p className="text-sm text-zinc-400">
                      {campaign.song.authorName || campaign.artist.name}
                    </p>
                    {campaign.song.duration !== null && (
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDuration(campaign.song.duration)}</span>
                      </div>
                    )}
                  </div>

                  {campaign.song.tiktokUrl && (
                    <a
                      href={campaign.song.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="outline" size="sm" className="w-full gap-2 border-white/10 hover:bg-white/5">
                        <Music2 className="h-4 w-4" />
                        TikTok&apos;ta Dinle
                      </Button>
                    </a>
                  )}

                  {/* Inline Music Stats */}
                  {campaign.song.tiktokMusicId && campaign.song.videoCount && (
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">TikTok Videoları</span>
                        <span className="font-semibold text-white">
                          {formatNumber(campaign.song.videoCount)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                          style={{
                            width: `${Math.min((campaign.song.videoCount / 50000) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-zinc-600">
                        {campaign.song.videoCount < 1000 && "Başlangıç"}
                        {campaign.song.videoCount >= 1000 && campaign.song.videoCount < 10000 && "Büyüyen"}
                        {campaign.song.videoCount >= 10000 && campaign.song.videoCount < 50000 && "Popüler"}
                        {campaign.song.videoCount >= 50000 && "Viral"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Zaman Çizelgesi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CampaignTimeline
                    createdAt={campaign.createdAt}
                    startDate={campaign.startDate}
                    endDate={campaign.endDate}
                    lockedAt={campaign.lockedAt}
                    completedAt={campaign.completedAt}
                    status={campaign.status}
                    durationDays={campaign.durationDays || 7}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        }
        analyticsContent={
          /* ============================================================= */
          /* TAB: ANALİTİK (Analytics)                                     */
          /* ============================================================= */
          <div className="space-y-6">
            {/* 2-column chart grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              <EngagementBreakdownChart
                viewPoints={totalViewPoints}
                likePoints={totalLikePoints}
                sharePoints={totalSharePoints}
              />
              <CreatorContributionChart
                creators={creatorChartData}
                capPercent={40}
              />
            </div>

            {/* Full-width submission metrics */}
            <SubmissionMetricsChart submissions={submissionMetrics} />

            {/* ROI Cards */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">Görüntülenme / ₺</p>
                    <p className="text-3xl font-bold text-white">
                      {viewsPerTL >= 1 ? formatNumber(Math.round(viewsPerTL)) : viewsPerTL.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">Her ₺1 için görüntülenme</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">Etkileşim / ₺</p>
                    <p className="text-3xl font-bold text-white">
                      {engagementPerTL >= 1 ? formatNumber(Math.round(engagementPerTL)) : engagementPerTL.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">Her ₺1 için etkileşim</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">Maliyet / Gönderi</p>
                    <p className="text-3xl font-bold text-white">
                      {approvedCount > 0 ? formatCurrency(totalBudget / approvedCount) : "—"}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">Onaylı gönderi başına maliyet</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        }
        submissionsContent={
          /* ============================================================= */
          /* TAB: GÖNDERİLER (Submissions)                                 */
          /* ============================================================= */
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Gönderiler</CardTitle>
              <CardDescription className="text-zinc-500">
                Bu kampanya için içerik üreticiler tarafından gönderilen videolar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionsTable submissions={formattedSubmissions} />
            </CardContent>
          </Card>
        }
        detailsContent={
          /* ============================================================= */
          /* TAB: DETAYLAR (Details)                                        */
          /* ============================================================= */
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left column */}
            <div className="space-y-6">
              {/* Description */}
              {campaign.description && (
                <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Kampanya Açıklaması
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {campaign.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Budget Details */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <TLIcon className="h-4 w-4" />
                    Bütçe Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Toplam Bütçe</span>
                    <span className="font-semibold text-white">{formatCurrency(totalBudget)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Komisyon (%{commissionPercent})</span>
                    <span className="text-zinc-400">-{formatCurrency(commissionAmount)}</span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400 font-medium">İçerik Üretici Havuzu</span>
                    <span className="font-bold text-purple-400">{formatCurrency(creatorPool)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Max Kazanç (kişi başı)</span>
                    <span className="font-medium text-zinc-300">{formatCurrency(creatorPool * 0.4)}</span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Başlangıç Tarihi</span>
                    <span className="font-semibold text-zinc-300">
                      {campaign.startDate ? formatDate(campaign.startDate) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Bitiş Tarihi</span>
                    <span className="font-semibold text-zinc-300">
                      {campaign.endDate ? formatDate(campaign.endDate) : `${campaign.durationDays || 7} gün`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Creator Requirements */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    İçerik Üretici Kriterleri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Katılım</span>
                    <span className="font-semibold text-green-400">Herkese Açık</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Min. Video Süresi</span>
                    <span className="font-semibold text-zinc-300">
                      {campaign.minVideoDuration ? `${campaign.minVideoDuration} saniye` : "Yok"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Min. Uygunluk Puanı</span>
                    <span className="font-semibold text-zinc-300">
                      {CalculationService.MIN_ELIGIBLE_CONTRIBUTION} tp
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Min. Katkı Oranı</span>
                    <span className="font-semibold text-zinc-300">%0.1</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Point System */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Puan Sistemi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Puan Kazanma
                    </h5>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-cyan-400" />
                          <span className="text-sm text-zinc-300">İzlenme</span>
                        </div>
                        <span className="text-sm font-bold text-white">1 = 0.01 tp</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-pink-400" />
                          <span className="text-sm text-zinc-300">Beğeni</span>
                        </div>
                        <span className="text-sm font-bold text-white">1 = 0.5 tp</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-zinc-300">Paylaşım</span>
                        </div>
                        <span className="text-sm font-bold text-white">1 = 1.0 tp</span>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Dağıtım Kuralları
                    </h5>
                    <div className="space-y-2 text-sm text-zinc-400">
                      <p>Kazançlar, her üreticinin toplam puana katkısına göre hesaplanır.</p>
                      <p>
                        <span className="text-white font-medium">Robin Hood Kuralı:</span> Bir üretici maksimum <span className="text-purple-400 font-bold">%40</span> kazanabilir.
                      </p>
                      <p>%40&apos;ı aşan kısım, diğer üreticilere orantılı olarak dağıtılır.</p>
                      <p className="text-zinc-500">Kesin kazançlar kampanya bitiminde hesaplanır.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Insurance Thresholds Info */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Sigorta Eşikleri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Bu bütçe aralığı ({formatCurrency(totalBudget)}) için gerekli minimum değerler:
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Min. Gönderi</span>
                    <span className="font-semibold text-zinc-300">{thresholds.minSubmissions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Min. Puan</span>
                    <span className="font-semibold text-zinc-300">{formatNumber(thresholds.minViews)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Min. Görüntülenme</span>
                    <span className="font-semibold text-zinc-300">{formatNumber(thresholds.minViews)}</span>
                  </div>
                  <Separator className="bg-white/5" />
                  <p className="text-xs text-zinc-600">
                    Tüm eşikler karşılanmazsa, net bütçe (%{100 - commissionPercent}) sanatçıya iade edilir.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        }
      />
    </div>
  );
}
