import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ExternalLink,
  Wallet,
  ShieldCheck,
  MessageCircle,
  Mail,
} from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import { MetricCard } from "@/components/analytics/metric-card";
import { CampaignApprovalSection } from "@/components/admin/campaign-approval-section";
import { AdminCampaignHeaderActions } from "@/components/admin/admin-header-actions";
import { FinishCampaignButton } from "@/components/admin/finish-campaign-button";
import { SubmissionsTable } from "@/components/submissions/submissions-table";
import { CalculationService } from "@/server/services/calculationService";

// Detail sub-components
import { CampaignHealthCard } from "@/components/campaigns/detail/campaign-health-card";
import { EngagementLinesChart } from "@/components/campaigns/detail/engagement-lines-chart";
import { EngagementBreakdownChart } from "@/components/campaigns/detail/engagement-breakdown-chart";
import { CreatorContributionChart } from "@/components/campaigns/detail/creator-contribution-chart";
import { SubmissionMetricsChart } from "@/components/campaigns/detail/submission-metrics-chart";
import { TopCreatorsCard } from "@/components/campaigns/detail/top-creators-card";
import { CampaignTimeline } from "@/components/campaigns/detail/campaign-timeline";
import { BudgetBreakdownChart } from "@/components/campaigns/detail/budget-breakdown-chart";
import { AdminCampaignTabs } from "@/components/admin/admin-campaign-tabs";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusConfig(status: string) {
  switch (status) {
    case "ACTIVE":
      return { label: "AKTİF", variant: "success" as const };
    case "PENDING_APPROVAL":
      return { label: "ONAY BEKLİYOR", variant: "warning" as const };
    case "COMPLETED":
      return { label: "TAMAMLANDI", variant: "secondary" as const };
    case "PAUSED":
      return { label: "DURAKLATILDI", variant: "warning" as const };
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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

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
          email: true,
          avatar: true,
          tiktokHandle: true,
          tiktokAvatarUrl: true,
          balance: true,
          followerCount: true,
          _count: { select: { campaigns: true } },
        },
      },
      submissions: {
        select: {
          id: true,
          status: true,
          tiktokUrl: true,
          creatorId: true,
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true,
          lastCommentCount: true,
          totalPoints: true,
          sharePercent: true,
          estimatedEarnings: true,
          totalEarnings: true,
          payoutAmount: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              tiktokHandle: true,
              avatar: true,
              tiktokAvatarUrl: true,
              followerCount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) notFound();

  // =========================================================================
  // DATA CALCULATIONS
  // =========================================================================

  const approvedSubs = campaign.submissions.filter(
    (s) => s.status === "APPROVED"
  );
  const pendingCount = campaign.submissions.filter(
    (s) => s.status === "PENDING"
  ).length;
  const rejectedCount = campaign.submissions.filter(
    (s) => s.status === "REJECTED"
  ).length;
  const totalSubmissions = campaign.submissions.length;
  const approvedCount = approvedSubs.length;

  // Engagement aggregates
  const totalViews = campaign.submissions.reduce(
    (s, sub) => s + sub.lastViewCount,
    0
  );
  const totalLikes = campaign.submissions.reduce(
    (s, sub) => s + sub.lastLikeCount,
    0
  );
  const totalShares = campaign.submissions.reduce(
    (s, sub) => s + sub.lastShareCount,
    0
  );
  const totalComments = campaign.submissions.reduce(
    (s, sub) => s + sub.lastCommentCount,
    0
  );

  // Budget
  const totalBudget = Number(campaign.totalBudget);
  const remainingBudget = Number(campaign.remainingBudget);
  const commissionPercent = campaign.commissionPercent || 20;
  const commissionAmount = (totalBudget * commissionPercent) / 100;
  const creatorPool = totalBudget - commissionAmount;
  const spentBudget = totalBudget - remainingBudget;

  // Engagement rate
  const engagementRate =
    totalViews > 0
      ? ((totalLikes + totalShares + totalComments) / totalViews) * 100
      : 0;

  // Points — use pre-computed DB value (updated by webhook recalculation)
  const totalCampaignScore = campaign.totalCampaignPoints;

  // Point breakdown by type (lightweight derivation for charts)
  const totalViewPoints = totalViews * 0.01;
  const totalLikePoints = totalLikes * 0.5;
  const totalSharePoints = totalShares * 1.0;

  // Averages
  const avgViewsPerSub =
    approvedCount > 0 ? Math.round(totalViews / approvedCount) : 0;
  const avgLikesPerSub =
    approvedCount > 0 ? Math.round(totalLikes / approvedCount) : 0;
  const avgSharesPerSub =
    approvedCount > 0 ? Math.round(totalShares / approvedCount) : 0;
  const avgPointsPerSub =
    approvedCount > 0 ? Math.round(totalCampaignScore / approvedCount) : 0;

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

  // Progress
  const now = new Date();
  const start = campaign.startDate ? new Date(campaign.startDate) : null;
  const end = campaign.endDate ? new Date(campaign.endDate) : null;
  const totalDurationMs =
    start && end
      ? end.getTime() - start.getTime()
      : (campaign.durationDays || 7) * 86400000;
  const elapsedMs = start ? Math.max(now.getTime() - start.getTime(), 0) : 0;
  const progressPercent =
    campaign.status === "COMPLETED"
      ? 100
      : start
        ? Math.min((elapsedMs / totalDurationMs) * 100, 100)
        : 0;
  const daysRemaining = end
    ? Math.max(Math.ceil((end.getTime() - now.getTime()) / 86400000), 0)
    : null;

  // Insurance
  const thresholds = CalculationService.getInsuranceThresholds(totalBudget);
  const insuranceCheck = CalculationService.checkInsuranceThresholds(
    totalBudget,
    approvedCount,
    totalCampaignScore,
    totalViews
  );

  // ROI
  const viewsPerTL = totalBudget > 0 ? totalViews / totalBudget : 0;
  const engagementPerTL =
    totalBudget > 0
      ? (totalLikes + totalShares + totalComments) / totalBudget
      : 0;

  // --- Use pre-computed DB values (Robin Hood applied by webhook recalculation) ---
  const formattedSubmissions = campaign.submissions.map((sub) => {
    const score = sub.totalPoints;
    const contributionPercent = totalCampaignScore > 0 ? (score / totalCampaignScore) * 100 : 0;
    const rawShare = totalCampaignScore > 0 ? score / totalCampaignScore : 0;
    return {
      ...sub,
      score,
      totalEarnings: Number(sub.totalEarnings) > 0 ? Number(sub.totalEarnings) : Number(sub.estimatedEarnings),
      estimatedEarnings: Number(sub.estimatedEarnings),
      payoutAmount: sub.payoutAmount ? Number(sub.payoutAmount) : null,
      contributionPercent,
      contributionPoints: score,
      isCapped: rawShare > 0.4,
    };
  });

  // --- Derived chart data ---
  const topCreators = [...formattedSubmissions]
    .sort((a, b) => (b.contributionPoints || 0) - (a.contributionPoints || 0))
    .slice(0, 10)
    .map((sub) => ({
      name: sub.creator.name || "İsimsiz",
      handle: sub.creator.tiktokHandle,
      avatar: sub.creator.avatar,
      points: sub.contributionPoints || 0,
      sharePercent: sub.contributionPercent || 0,
      estimatedEarnings: Number(sub.estimatedEarnings) || 0,
    }));

  const creatorChartData = formattedSubmissions
    .filter((sub) => sub.status === "APPROVED")
    .map((sub) => ({
      name:
        sub.creator.name || sub.creator.tiktokHandle || "İsimsiz",
      sharePercent: sub.contributionPercent || 0,
      points: sub.contributionPoints || 0,
      earnings: Number(sub.estimatedEarnings) || 0,
      isCapped: sub.isCapped || false,
    }));

  const submissionMetrics = formattedSubmissions
    .filter((sub) => sub.status === "APPROVED")
    .map((sub) => {
      const v = sub.lastViewCount || 0;
      const l = sub.lastLikeCount || 0;
      const s = sub.lastShareCount || 0;
      const c = sub.lastCommentCount || 0;
      const er = v > 0 ? ((l + s + c) / v) * 100 : 0;
      return {
        creatorName:
          sub.creator.name || sub.creator.tiktokHandle || "İsimsiz",
        views: v,
        likes: l,
        shares: s,
        engagementRate: Math.round(er * 100) / 100,
        points: sub.contributionPoints || 0,
      };
    });

  const engagementLinesData = formattedSubmissions
    .filter((sub) => sub.status === "APPROVED")
    .sort((a, b) => (b.lastViewCount || 0) - (a.lastViewCount || 0))
    .slice(0, 20)
    .map((sub) => ({
      name:
        sub.creator.name || sub.creator.tiktokHandle || "İsimsiz",
      views: sub.lastViewCount || 0,
      likes: sub.lastLikeCount || 0,
      shares: sub.lastShareCount || 0,
    }));

  const statusConfig = getStatusConfig(campaign.status);
  const showAnalytics = ["ACTIVE", "PAUSED", "COMPLETED"].includes(
    campaign.status
  );
  const showHealth = ["ACTIVE", "PAUSED", "COMPLETED"].includes(
    campaign.status
  );
  const showProgress =
    !!start &&
    campaign.status !== "PENDING_APPROVAL" &&
    campaign.status !== "REJECTED";
  const isPending = campaign.status === "PENDING_APPROVAL";

  // Budget chart segments
  const budgetSegments = [
    { name: "Komisyon", value: commissionAmount, color: "#22c55e" },
    { name: "Ödül Havuzu", value: creatorPool, color: "#a855f7" },
  ];

  // Unique creators count
  const uniqueCreators = new Set(
    campaign.submissions.map((s) => s.creatorId)
  ).size;

  // Artist avatar
  const artistAvatar =
    campaign.artist.tiktokAvatarUrl || campaign.artist.avatar || null;
  const artistInitials = (campaign.artist.name || campaign.artist.email)
    .slice(0, 2)
    .toUpperCase();

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
          {/* Left: Back + Cover + Title */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin/campaigns">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-white/5"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            {campaign.song.coverImage ? (
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10">
                <Image
                  src={campaign.song.coverImage}
                  alt={campaign.song.title}
                  fill
                  className="object-cover"
                  unoptimized={campaign.song.coverImage.includes("tiktokcdn")}
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
                  {campaign.title}
                </h1>
                <Badge variant={statusConfig.variant}>
                  {statusConfig.label}
                </Badge>
                {campaign.insuranceTriggered && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] gap-1"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Sigorta
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-400 truncate">
                {campaign.song.title} &middot;{" "}
                {campaign.song.authorName || campaign.artist.name}
              </p>
            </div>
          </div>

          {/* Right: Admin Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <AdminCampaignHeaderActions
              campaignId={campaign.id}
              currentStatus={campaign.status}
            />
            <FinishCampaignButton
              campaignId={campaign.id}
              campaignStatus={campaign.status}
            />
          </div>
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-zinc-500">
                {campaign.status === "COMPLETED"
                  ? "Kampanya tamamlandı"
                  : campaign.status === "PAUSED"
                    ? "Kampanya duraklatıldı"
                    : "Kampanya ilerlemesi"}
              </span>
              <span className="text-zinc-400 font-medium">
                {campaign.status === "COMPLETED"
                  ? "100%"
                  : daysRemaining !== null
                    ? daysRemaining > 0
                      ? `${daysRemaining} gün kaldı`
                      : "Süre doldu"
                    : `${campaign.durationDays || 7} gün`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  campaign.status === "COMPLETED"
                    ? "bg-gradient-to-r from-green-500 to-emerald-400"
                    : campaign.status === "PAUSED"
                      ? "bg-gradient-to-r from-yellow-500 to-amber-400"
                      : "bg-gradient-to-r from-purple-500 to-pink-500"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* APPROVAL PANEL (PENDING ONLY)                                     */}
      {/* ================================================================= */}
      {isPending && (
        <CampaignApprovalSection
          campaignId={campaign.id}
          totalBudget={totalBudget}
          commissionPercent={commissionPercent}
          status={campaign.status}
          desiredStartDate={
            campaign.desiredStartDate?.toISOString() ?? null
          }
        />
      )}

      {/* ================================================================= */}
      {/* KPI CARDS                                                         */}
      {/* ================================================================= */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Toplam Bütçe"
          value={formatCurrency(totalBudget)}
          description={`Havuz: ${formatCurrency(creatorPool)}`}
          variant="premium"
          icon={<TLIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Gönderiler"
          value={`${approvedCount}/${totalSubmissions}`}
          description={
            pendingCount > 0
              ? `${pendingCount} beklemede`
              : rejectedCount > 0
                ? `${rejectedCount} reddedildi`
                : "Tüm gönderiler onaylı"
          }
          variant="success"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Görüntülenme"
          value={formatNumber(totalViews)}
          description={
            approvedCount > 0
              ? `Ort: ${formatNumber(avgViewsPerSub)}`
              : "Henüz veri yok"
          }
          variant="primary"
          icon={<Eye className="h-4 w-4" />}
        />
        <MetricCard
          title="Etkileşim"
          value={`%${engagementRate.toFixed(2)}`}
          description={`${formatNumber(totalLikes + totalShares + totalComments)} toplam`}
          variant="warning"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Toplam Puan"
          value={`${formatNumber(totalCampaignScore)} tp`}
          description={
            approvedCount > 0
              ? `Ort: ${formatNumber(avgPointsPerSub)} tp`
              : "Henüz puan yok"
          }
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
              {formatNumber(avgViewsPerSub)}
            </p>
            <p className="text-[11px] text-zinc-600">gönderi başına</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-xs text-zinc-500">Ort. Beğeni</span>
            </div>
            <p className="text-lg font-bold text-white">
              {formatNumber(avgLikesPerSub)}
            </p>
            <p className="text-[11px] text-zinc-600">gönderi başına</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-zinc-500">Ort. Paylaşım</span>
            </div>
            <p className="text-lg font-bold text-white">
              {formatNumber(avgSharesPerSub)}
            </p>
            <p className="text-[11px] text-zinc-600">gönderi başına</p>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TABBED CONTENT                                                    */}
      {/* ================================================================= */}
      <AdminCampaignTabs
        submissionCount={totalSubmissions}
        showAnalytics={showAnalytics}
        /* ============================================================= */
        /* TAB 1: GENEL BAKIŞ (Overview)                                 */
        /* ============================================================= */
        overviewContent={
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2/3 */}
            <div className="lg:col-span-2 space-y-6">
              {/* Campaign Health */}
              {showHealth && (
                <CampaignHealthCard
                  insurancePassed={insuranceCheck.passed}
                  submissionProgress={{
                    current: approvedCount,
                    required: thresholds.minSubmissions,
                  }}
                  pointsProgress={{
                    current: Math.round(totalCampaignScore),
                    required: thresholds.minPoints,
                  }}
                  viewsProgress={{
                    current: totalViews,
                    required: thresholds.minViews,
                  }}
                  status={campaign.status}
                />
              )}

              {/* Engagement Lines */}
              <EngagementLinesChart data={engagementLinesData} />

              {/* Top Creators */}
              <TopCreatorsCard creators={topCreators} />
            </div>

            {/* Right 1/3 */}
            <div className="space-y-6">
              {/* Artist Info — ADMIN EXCLUSIVE */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Sanatçı Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-white/10">
                      <AvatarImage
                        src={artistAvatar || undefined}
                        alt={campaign.artist.name || "Artist"}
                      />
                      <AvatarFallback className="bg-white/5 text-white text-sm">
                        {artistInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">
                        {campaign.artist.name || "İsimsiz"}
                      </p>
                      <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {campaign.artist.email}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                      <p className="text-xs text-zinc-500">Bakiye</p>
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(Number(campaign.artist.balance))}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                      <p className="text-xs text-zinc-500">Kampanyalar</p>
                      <p className="text-sm font-bold text-white">
                        {campaign.artist._count.campaigns}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                      <p className="text-xs text-zinc-500">Takipçi</p>
                      <p className="text-sm font-bold text-white">
                        {formatNumber(campaign.artist.followerCount)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                      <p className="text-xs text-zinc-500">TikTok</p>
                      <p className="text-sm font-bold text-white truncate">
                        {campaign.artist.tiktokHandle ? (
                          <a
                            href={`https://www.tiktok.com/@${campaign.artist.tiktokHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            @{campaign.artist.tiktokHandle}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Song Info */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Music2 className="h-4 w-4" />
                    Şarkı Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-white/10 bg-white/5">
                    {campaign.song.coverImage ? (
                      <Image
                        src={campaign.song.coverImage}
                        alt={campaign.song.title}
                        fill
                        className="object-cover"
                        priority
                        unoptimized={campaign.song.coverImage.includes(
                          "tiktokcdn"
                        )}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Music2 className="h-16 w-16 text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-white line-clamp-1">
                      {campaign.song.title}
                    </h3>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-white/10 hover:bg-white/5"
                      >
                        <Music2 className="h-4 w-4" />
                        TikTok&apos;ta Dinle
                      </Button>
                    </a>
                  )}
                  {campaign.song.tiktokMusicId && campaign.song.videoCount ? (
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">TikTok Videoları</span>
                        <span className="font-semibold text-white">
                          {formatNumber(campaign.song.videoCount)}
                        </span>
                      </div>
                    </div>
                  ) : null}
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
        /* ============================================================= */
        /* TAB 2: FİNANSAL (Financial)                                   */
        /* ============================================================= */
        financialContent={
          <div className="space-y-6">
            {/* Budget breakdown + details side by side */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Budget Donut */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <TLIcon className="h-4 w-4" />
                    Bütçe Dağılımı
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BudgetBreakdownChart
                    segments={budgetSegments}
                    totalBudget={totalBudget}
                    creatorPool={creatorPool}
                  />
                </CardContent>
              </Card>

              {/* Budget Detail Table */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Finansal Detaylar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Toplam Bütçe
                    </span>
                    <span className="font-bold text-white">
                      {formatCurrency(totalBudget)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Komisyon (%{commissionPercent})
                    </span>
                    <span className="font-semibold text-green-400">
                      {formatCurrency(commissionAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Ödül Havuzu
                    </span>
                    <span className="font-semibold text-purple-400">
                      {formatCurrency(creatorPool)}
                    </span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Max Kazanç (kişi başı)
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {formatCurrency(creatorPool * 0.4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Benzersiz Creator
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {uniqueCreators}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Ödeme Durumu
                    </span>
                    <Badge
                      variant={
                        campaign.payoutStatus === "COMPLETED"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {campaign.payoutStatus === "COMPLETED"
                        ? "Tamamlandı"
                        : "Beklemede"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ROI Cards */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">
                      Görüntülenme / ₺
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {viewsPerTL >= 1
                        ? formatNumber(Math.round(viewsPerTL))
                        : viewsPerTL.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Her ₺1 için görüntülenme
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">
                      Etkileşim / ₺
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {engagementPerTL >= 1
                        ? formatNumber(Math.round(engagementPerTL))
                        : engagementPerTL.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Her ₺1 için etkileşim
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">
                      Maliyet / Gönderi
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {approvedCount > 0
                        ? formatCurrency(totalBudget / approvedCount)
                        : "—"}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Onaylı gönderi başına
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">
                      Maliyet / 1K Görüntülenme
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {totalViews > 0
                        ? formatCurrency((totalBudget / totalViews) * 1000)
                        : "—"}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">CPM</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Creator Earnings Leaderboard */}
            {formattedSubmissions.length > 0 && (
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Creator Kazanç Tablosu
                  </CardTitle>
                  <CardDescription className="text-zinc-600">
                    Tahmini kazançlar — kesin değerler kampanya bitiminde hesaplanır
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-zinc-500 text-xs">
                          <th className="text-left py-2 px-2 font-medium">#</th>
                          <th className="text-left py-2 px-2 font-medium">Creator</th>
                          <th className="text-right py-2 px-2 font-medium">Puan</th>
                          <th className="text-right py-2 px-2 font-medium">Katkı %</th>
                          <th className="text-right py-2 px-2 font-medium">Tahmini Kazanç</th>
                          <th className="text-right py-2 px-2 font-medium">Görüntülenme</th>
                          <th className="text-center py-2 px-2 font-medium">Robin Hood</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...formattedSubmissions]
                          .sort(
                            (a, b) =>
                              (b.contributionPoints || 0) -
                              (a.contributionPoints || 0)
                          )
                          .map((sub, i) => (
                            <tr
                              key={sub.id}
                              className="border-b border-white/5 hover:bg-white/[0.02]"
                            >
                              <td className="py-2 px-2 text-zinc-500">
                                {i + 1}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage
                                      src={
                                        sub.creator.tiktokAvatarUrl ||
                                        sub.creator.avatar ||
                                        undefined
                                      }
                                    />
                                    <AvatarFallback className="text-[10px] bg-white/5">
                                      {(
                                        sub.creator.name ||
                                        sub.creator.tiktokHandle ||
                                        "?"
                                      )
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-white truncate max-w-[120px]">
                                    {sub.creator.tiktokHandle
                                      ? `@${sub.creator.tiktokHandle}`
                                      : sub.creator.name || "İsimsiz"}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right text-zinc-300 tabular-nums">
                                {formatNumber(sub.contributionPoints || 0)}
                              </td>
                              <td className="py-2 px-2 text-right text-zinc-300 tabular-nums">
                                {(sub.contributionPercent || 0).toFixed(1)}%
                              </td>
                              <td className="py-2 px-2 text-right font-semibold text-green-400 tabular-nums">
                                {formatCurrency(
                                  Number(sub.estimatedEarnings) || 0
                                )}
                              </td>
                              <td className="py-2 px-2 text-right text-zinc-300 tabular-nums">
                                {formatNumber(sub.lastViewCount)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {sub.isCapped ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-orange-400 border-orange-400/30"
                                  >
                                    %40 Cap
                                  </Badge>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        }
        /* ============================================================= */
        /* TAB 3: ANALİTİK (Analytics)                                   */
        /* ============================================================= */
        analyticsContent={
          <div className="space-y-6">
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
            <SubmissionMetricsChart submissions={submissionMetrics} />

            {/* Engagement summary cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs text-zinc-500">Görüntülenme</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(totalViews)}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Ort: {formatNumber(avgViewsPerSub)}/gönderi
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-pink-400" />
                    <span className="text-xs text-zinc-500">Beğeni</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(totalLikes)}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {totalViewPoints > 0
                      ? `${((totalLikePoints / totalCampaignScore) * 100).toFixed(1)}% puan katkısı`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Share2 className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-zinc-500">Paylaşım</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(totalShares)}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {totalCampaignScore > 0
                      ? `${((totalSharePoints / totalCampaignScore) * 100).toFixed(1)}% puan katkısı`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-zinc-500">Yorum</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(totalComments)}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {totalViews > 0
                      ? `${((totalComments / totalViews) * 100).toFixed(2)}% oran`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        }
        /* ============================================================= */
        /* TAB 4: GÖNDERİLER (Submissions)                              */
        /* ============================================================= */
        submissionsContent={
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Gönderiler</CardTitle>
              <CardDescription className="text-zinc-500">
                {totalSubmissions} gönderi &middot; {approvedCount} onaylı
                &middot; {pendingCount} beklemede &middot; {rejectedCount}{" "}
                reddedildi &middot; {uniqueCreators} benzersiz creator
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionsTable submissions={formattedSubmissions} />
            </CardContent>
          </Card>
        }
        /* ============================================================= */
        /* TAB 5: DETAYLAR (Details & Settings)                          */
        /* ============================================================= */
        detailsContent={
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

              {/* Campaign Settings */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Kampanya Ayarları
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Katılım</span>
                    <span className="font-semibold text-green-400">
                      Herkese Açık
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Komisyon</span>
                    <span className="font-semibold text-zinc-300">
                      %{commissionPercent}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Süre</span>
                    <span className="font-semibold text-zinc-300">
                      {campaign.durationDays || 7} gün
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Min. Video Süresi
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {campaign.minVideoDuration
                        ? `${campaign.minVideoDuration} saniye`
                        : "Yok"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Min. Uygunluk Puanı
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {CalculationService.MIN_ELIGIBLE_POINTS} tp
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Robin Hood Cap
                    </span>
                    <span className="font-semibold text-zinc-300">%40</span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Ödeme Durumu
                    </span>
                    <Badge
                      variant={
                        campaign.payoutStatus === "COMPLETED"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {campaign.payoutStatus === "COMPLETED"
                        ? "Tamamlandı"
                        : "Beklemede"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Sigorta Tetiklendi
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        campaign.insuranceTriggered
                          ? "text-red-400"
                          : "text-zinc-600"
                      )}
                    >
                      {campaign.insuranceTriggered ? "Evet" : "Hayır"}
                    </span>
                  </div>
                  {campaign.rejectionReason && (
                    <>
                      <Separator className="bg-white/5" />
                      <div>
                        <span className="text-sm text-zinc-500">
                          Red Nedeni
                        </span>
                        <p className="text-sm text-red-400 mt-1">
                          {campaign.rejectionReason}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Dates */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Tarihler
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Oluşturulma
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {formatDate(campaign.createdAt)}
                    </span>
                  </div>
                  {campaign.desiredStartDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">
                        İstenen Başlangıç
                      </span>
                      <span className="font-semibold text-zinc-300">
                        {formatDate(campaign.desiredStartDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Başlangıç</span>
                    <span className="font-semibold text-zinc-300">
                      {campaign.startDate
                        ? formatDate(campaign.startDate)
                        : "Onay bekleniyor"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Bitiş</span>
                    <span className="font-semibold text-zinc-300">
                      {campaign.endDate
                        ? formatDate(campaign.endDate)
                        : `${campaign.durationDays || 7} gün (onay sonrası)`}
                    </span>
                  </div>
                  {campaign.lockedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">
                        Kilitlenme
                      </span>
                      <span className="font-semibold text-zinc-300">
                        {formatDate(campaign.lockedAt)}
                      </span>
                    </div>
                  )}
                  {campaign.completedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">
                        Tamamlanma
                      </span>
                      <span className="font-semibold text-zinc-300">
                        {formatDate(campaign.completedAt)}
                      </span>
                    </div>
                  )}
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-cyan-400" />
                        <span className="text-sm text-zinc-300">
                          İzlenme
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        1 = 0.01 tp
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-pink-400" />
                        <span className="text-sm text-zinc-300">
                          Beğeni
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        1 = 0.5 tp
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-zinc-300">
                          Paylaşım
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        1 = 1.0 tp
                      </span>
                    </div>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="space-y-2 text-sm text-zinc-400">
                    <p>
                      Kazançlar, her üreticinin toplam puana katkısına göre
                      hesaplanır.
                    </p>
                    <p>
                      <span className="text-white font-medium">
                        Robin Hood Kuralı:
                      </span>{" "}
                      Maksimum{" "}
                      <span className="text-purple-400 font-bold">%40</span>{" "}
                      kazanabilir.
                    </p>
                    <p className="text-zinc-500">
                      Kesin kazançlar kampanya bitiminde hesaplanır.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Insurance Thresholds */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Sigorta Eşikleri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Bu bütçe aralığı ({formatCurrency(totalBudget)}) için
                    gerekli minimum değerler:
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Min. Gönderi
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        approvedCount >= thresholds.minSubmissions
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      {approvedCount}/{thresholds.minSubmissions}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Min. Puan</span>
                    <span
                      className={cn(
                        "font-semibold",
                        totalCampaignScore >= thresholds.minPoints
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      {formatNumber(Math.round(totalCampaignScore))}/
                      {formatNumber(thresholds.minPoints)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Min. Görüntülenme
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        totalViews >= thresholds.minViews
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      {formatNumber(totalViews)}/
                      {formatNumber(thresholds.minViews)}
                    </span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Sigorta Durumu
                    </span>
                    <Badge
                      variant={
                        insuranceCheck.passed ? "default" : "destructive"
                      }
                    >
                      {insuranceCheck.passed
                        ? "Eşikler Karşılandı"
                        : "Eşikler Karşılanmadı"}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-600">
                    Tüm eşikler karşılanmazsa, net bütçe (%
                    {100 - commissionPercent}) sanatçıya iade edilir.
                  </p>
                </CardContent>
              </Card>

              {/* Campaign ID & Meta */}
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-400">
                    Teknik Bilgiler
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Kampanya ID
                    </span>
                    <code className="text-xs text-zinc-400 bg-white/5 px-2 py-1 rounded">
                      {campaign.id}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Sanatçı ID
                    </span>
                    <code className="text-xs text-zinc-400 bg-white/5 px-2 py-1 rounded">
                      {campaign.artistId}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Şarkı ID</span>
                    <code className="text-xs text-zinc-400 bg-white/5 px-2 py-1 rounded">
                      {campaign.songId}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        }
      />
    </div>
  );
}
