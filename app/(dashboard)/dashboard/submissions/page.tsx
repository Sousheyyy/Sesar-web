import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { TrendingUp, ExternalLink, DollarSign, Eye, Heart, Share2, Video, CheckCircle2, XCircle, Clock, ArrowUpRight, Award } from "lucide-react";
import Link from "next/link";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function SubmissionsPage() {
  const user = await requireAuth();

  const submissions = await prisma.submission.findMany({
    where: {
      creatorId: user.id,
    },
    include: {
      campaign: {
        include: {
          song: true,
          submissions: true, // Get all submissions to calculate percentages
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Calculate total earnings from completed campaigns (already earned)
  const totalEarnings = submissions.reduce(
    (sum, sub) => {
      if (sub.campaign.payoutStatus === "COMPLETED") {
        return sum + Number(sub.totalEarnings);
      }
      return sum;
    },
    0
  );

  // Calculate estimated earnings from ongoing campaigns (not yet finalized)
  const estimatedEarnings = submissions.reduce(
    (sum, sub) => {
      if (sub.campaign.payoutStatus === "PENDING" && sub.status === "APPROVED") {
        return sum + Number(sub.estimatedEarnings || 0);
      }
      return sum;
    },
    0
  );
  
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Gönderilerim</h2>
        <p className="text-muted-foreground mt-1">
          Video gönderilerinizi ve kazançlarınızı takip edin
        </p>
      </div>

      {/* Enhanced Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Earnings Card */}
        <Card className="overflow-hidden border-2 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardTitle className="text-sm font-semibold">Toplam Kazanç</CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-4">
            <div className="text-3xl font-bold text-primary mb-2">
              {formatCurrency(totalEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Tamamlanan kampanyalardan kazanılan
            </p>
          </CardContent>
        </Card>

        {/* Estimated Earnings Card */}
        <Card className="overflow-hidden border-2 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10">
            <CardTitle className="text-sm font-semibold">Öngörülen Kazanç</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-4">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {formatCurrency(estimatedEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Devam eden kampanyalardan tahmini
            </p>
          </CardContent>
        </Card>

        {/* Total Submissions Card */}
        <Card className="overflow-hidden border-2 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <CardTitle className="text-sm font-semibold">Toplam Gönderi</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-4">
            <div className="text-3xl font-bold mb-2">{submissions.length}</div>
            <p className="text-xs text-muted-foreground">
              {approvedCount} onaylandı
            </p>
          </CardContent>
        </Card>

        {/* Total Views Card */}
        <Card className="overflow-hidden border-2 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <CardTitle className="text-sm font-semibold">Toplam Görüntülenme</CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-4">
            <div className="text-3xl font-bold mb-2">
              {formatNumber(
                submissions.reduce((sum, sub) => sum + sub.lastViewCount, 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Tüm videolarda
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Grid */}
      <div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-1">Gönderiler</h3>
          <p className="text-sm text-muted-foreground">
            Tüm video gönderileriniz ve performansları
          </p>
        </div>

        {submissions.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Video className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Henüz hiç video göndermediniz</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Kampanyalara katılarak videolarınızı paylaşın ve kazanmaya başlayın
              </p>
              <Link href="/dashboard/marketplace">
                <Button size="lg" className="gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Kampanyalara Göz Atın
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {submissions.map((submission) => {
              const views = submission.lastViewCount || 0;
              const likes = submission.lastLikeCount || 0;
              const shares = submission.lastShareCount || 0;
              
              // Calculate points for each metric
              const viewScore = views * 0.01;
              const likeScore = likes * 0.5;
              const shareScore = shares * 1.0;
              const totalScore = viewScore + likeScore + shareScore;
              
              // Calculate total campaign score for percentage
              const totalCampaignScore = submission.campaign.submissions.reduce((acc, sub) => {
                const v = sub.lastViewCount || 0;
                const l = sub.lastLikeCount || 0;
                const s = sub.lastShareCount || 0;
                return acc + (v * 0.01) + (l * 0.5) + (s * 1.0);
              }, 0);
              
              const contributionPercent = totalCampaignScore > 0 
                ? (totalScore / totalCampaignScore) * 100 
                : 0;
              
              // Determine earnings based on payout status
              const earnings = submission.campaign.payoutStatus === "COMPLETED"
                ? Number(submission.totalEarnings)
                : Number(submission.estimatedEarnings || 0);
              
              // Campaign status text and color
              const getCampaignStatus = () => {
                if (submission.campaign.status === "COMPLETED") {
                  return { text: "Bitti", className: "bg-green-600 text-white dark:bg-green-700 dark:text-white font-semibold" };
                } else if (submission.campaign.status === "PAUSED") {
                  return { text: "Durduruldu", className: "bg-amber-600 text-white dark:bg-amber-700 dark:text-white font-semibold" };
                } else if (submission.campaign.status === "CANCELLED") {
                  return { text: "İptal", className: "bg-red-600 text-white dark:bg-red-700 dark:text-white font-semibold" };
                } else if (submission.campaign.status === "ACTIVE") {
                  return { text: "Devam Ediyor", className: "bg-blue-600 text-white dark:bg-blue-700 dark:text-white font-semibold" };
                }
                return { text: "Onay Bekliyor", className: "bg-gray-600 text-white dark:bg-gray-700 dark:text-white font-semibold" };
              };
              
              const campaignStatus = getCampaignStatus();

              // Submission status
              const getSubmissionStatus = () => {
                if (submission.status === "APPROVED") {
                  return {
                    icon: CheckCircle2,
                    text: "Onaylandı",
                    className: "bg-green-600 text-white dark:bg-green-700 dark:text-white border-green-700 dark:border-green-600",
                    iconClassName: "text-white"
                  };
                } else if (submission.status === "REJECTED") {
                  return {
                    icon: XCircle,
                    text: "Reddedildi",
                    className: "bg-red-600 text-white dark:bg-red-700 dark:text-white border-red-700 dark:border-red-600",
                    iconClassName: "text-white"
                  };
                } else {
                  return {
                    icon: Clock,
                    text: "Beklemede",
                    className: "bg-yellow-600 text-white dark:bg-yellow-700 dark:text-white border-yellow-700 dark:border-yellow-600",
                    iconClassName: "text-white"
                  };
                }
              };

              const submissionStatus = getSubmissionStatus();
              const StatusIcon = submissionStatus.icon;

              return (
                <Card 
                  key={submission.id}
                  className="group overflow-hidden border-2 hover:shadow-xl hover:border-primary/50 transition-all duration-300 hover:scale-[1.02]"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/dashboard/marketplace/${submission.campaign.id}`}
                          className="font-semibold text-base hover:text-primary transition-colors line-clamp-2"
                        >
                          {submission.campaign.title}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {submission.campaign.song.title}
                        </p>
                      </div>
                      <Badge className={`text-[10px] px-2 py-0.5 shrink-0 ${campaignStatus.className}`}>
                        {campaignStatus.text}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className={`text-xs px-3 py-1 gap-1.5 ${submissionStatus.className}`}
                      >
                        <StatusIcon className={`h-3.5 w-3.5 ${submissionStatus.iconClassName}`} />
                        {submissionStatus.text}
                      </Badge>
                    </div>

                    {submission.status === "REJECTED" && submission.rejectionReason && (
                      <div className="mt-2 p-2.5 rounded-md bg-red-50 dark:bg-red-950/60 border-2 border-red-400 dark:border-red-800">
                        <p className="text-xs font-semibold text-red-900 dark:text-red-100">
                          {submission.rejectionReason}
                        </p>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Performance Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <Eye className="h-4 w-4 text-muted-foreground mb-1.5" />
                        <span className="text-sm font-semibold">{formatNumber(views)}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {formatNumber(viewScore)} tp
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <Heart className="h-4 w-4 text-muted-foreground mb-1.5" />
                        <span className="text-sm font-semibold">{formatNumber(likes)}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {formatNumber(likeScore)} tp
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <Share2 className="h-4 w-4 text-muted-foreground mb-1.5" />
                        <span className="text-sm font-semibold">{formatNumber(shares)}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {formatNumber(shareScore)} tp
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <Award className="h-4 w-4 text-muted-foreground mb-1.5" />
                        <span className="text-sm font-semibold">{formatNumber(totalScore)}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          Toplam Puan
                        </span>
                      </div>
                    </div>

                    {/* Contribution Percentage with Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Katkı Oranı</span>
                        <span className="font-semibold">{contributionPercent.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(contributionPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Earnings */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Toplam Kazanç</p>
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(earnings)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {submission.campaign.payoutStatus === "COMPLETED" ? "Kesin" : "Tahmini"}
                          </p>
                        </div>
                        <a
                          href={submission.tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 border-2 border-primary bg-primary text-white hover:bg-primary/90 hover:text-white hover:border-primary/90 transition-colors font-semibold shadow-sm"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Video
                          </Button>
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


