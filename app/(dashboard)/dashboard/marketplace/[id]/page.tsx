import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { 
  ArrowLeft, 
  Music2, 
  TrendingUp, 
  Users, 
  ExternalLink, 
  Info, 
  DollarSign, 
  Clock, 
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Heart,
  Share2,
  Target,
  Zap,
  AlertCircle
} from "lucide-react";
import { SubmissionForm } from "@/components/submissions/submission-form";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function CampaignMarketplaceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();

  // Fetch user's TikTok handle
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tiktokHandle: true },
  });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      song: true,
      artist: {
        select: {
          id: true,
          name: true,
          bio: true,
          avatar: true,
        },
      },
      submissions: {
        select: {
          id: true,
          creatorId: true,
          tiktokUrl: true,
          status: true,
          rejectionReason: true,
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true,
          estimatedEarnings: true,
          contributionPercent: true,
        },
      },
      _count: {
        select: {
          submissions: true,
        },
      },
    },
  });

  if (!campaign || campaign.status !== "ACTIVE") {
    notFound();
  }

  // Filter user's submissions
  const userSubmissions = campaign.submissions.filter(sub => sub.creatorId === user.id);
  const hasSubmitted = userSubmissions.length > 0;
  const userSubmission = userSubmissions[0];
  // Allow resubmission if the previous submission was rejected
  const canResubmit = hasSubmitted && userSubmission?.status === "REJECTED";

  // Calculate total metrics for the campaign (all submissions)
  const totalCampaignViews = campaign.submissions.reduce((sum, sub) => sum + (sub.lastViewCount || 0), 0);
  const totalCampaignLikes = campaign.submissions.reduce((sum, sub) => sum + (sub.lastLikeCount || 0), 0);
  const totalCampaignShares = campaign.submissions.reduce((sum, sub) => sum + (sub.lastShareCount || 0), 0);
  
  // Calculate total points for the campaign
  const totalCampaignPoints = campaign.submissions.reduce((sum, sub) => {
    const viewScore = (sub.lastViewCount || 0) * 0.01;
    const likeScore = (sub.lastLikeCount || 0) * 0.5;
    const shareScore = (sub.lastShareCount || 0) * 1.0;
    return sum + viewScore + likeScore + shareScore;
  }, 0);

  // Calculate points for individual metrics
  const totalViewPoints = totalCampaignViews * 0.01;
  const totalLikePoints = totalCampaignLikes * 0.5;
  const totalSharePoints = totalCampaignShares * 1.0;

  // Calculate max potential earnings (40% of net pool)
  const poolPercent = 100 - campaign.platformFeePercent - campaign.safetyReservePercent;
  const poolAmount = (Number(campaign.totalBudget) * poolPercent) / 100;
  const maxEarnings = poolAmount * 0.4; // 40% Robin Hood cap

  // Calculate days remaining
  const now = new Date();
  const endDate = new Date(campaign.endDate);
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/dashboard/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Pazar Yerine Dön
          </Link>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Large Cover Image */}
            <div className="relative h-64 w-64 lg:h-80 lg:w-80 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-primary/20 shadow-lg bg-muted">
              {campaign.song.coverImage ? (
                <Image
                  src={campaign.song.coverImage}
                  alt={campaign.song.title}
                  fill
                  sizes="(max-width: 1024px) 256px, 320px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Music2 className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Title and Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-2">
                  {campaign.song.title}
                </h1>
                <p className="text-xl text-muted-foreground">
                  {campaign.song.authorName || campaign.artist.name}
                </p>
                {campaign.title && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {campaign.title}
                  </p>
                )}
                
                {/* Campaign Dates */}
                <div className="flex flex-wrap items-center gap-4 mt-4 p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs text-muted-foreground">Başlangıç:</span>
                      <span className="ml-2 text-sm font-semibold">
                        {formatDate(campaign.startDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs text-muted-foreground">Bitiş:</span>
                      <span className="ml-2 text-sm font-semibold">
                        {formatDate(campaign.endDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Max Kazanç
                      </CardTitle>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(maxEarnings)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Katılımcılar
                      </CardTitle>
                    </div>
                    <div className="text-2xl font-bold">
                      {campaign._count.submissions}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Kalan Süre
                      </CardTitle>
                    </div>
                    <div className="text-2xl font-bold">
                      {daysRemaining}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">gün</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Toplam Puan
                      </CardTitle>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatNumber(totalCampaignPoints)} tp
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Main Content (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Submission Section or Status Display */}
            {hasSubmitted && !canResubmit ? (
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl mb-2">Gönderiniz</CardTitle>
                      <CardDescription>
                        Video durumunuz ve performans metrikleri
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        userSubmission.status === "APPROVED"
                          ? "success"
                          : userSubmission.status === "REJECTED"
                          ? "destructive"
                          : "warning"
                      }
                      className="text-sm px-4 py-1.5"
                    >
                      {userSubmission.status === "PENDING" && (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          BEKLEMEDE
                        </>
                      )}
                      {userSubmission.status === "APPROVED" && (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          ONAYLANDI
                        </>
                      )}
                      {userSubmission.status === "REJECTED" && (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          REDDEDİLDİ
                        </>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status Message */}
                  <div className={`rounded-lg p-4 ${
                    userSubmission.status === "APPROVED" 
                      ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                      : userSubmission.status === "REJECTED"
                      ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                      : "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
                  }`}>
                    <p className={`text-sm font-medium ${
                      userSubmission.status === "APPROVED"
                        ? "text-green-900 dark:text-green-100"
                        : userSubmission.status === "REJECTED"
                        ? "text-red-900 dark:text-red-100"
                        : "text-yellow-900 dark:text-yellow-100"
                    }`}>
                      {userSubmission.status === "PENDING" &&
                        "Gönderiniz inceleniyor. Onaylandıktan sonra performans metrikleriniz görüntülenecektir."}
                      {userSubmission.status === "APPROVED" &&
                        "Tebrikler! Gönderiniz onaylandı ve kampanyaya katıldı. Performans metrikleriniz aşağıda görüntülenmektedir."}
                      {userSubmission.status === "REJECTED" &&
                        `Reddedildi: ${userSubmission.rejectionReason || "Sebep belirtilmedi"}`}
                    </p>
                  </div>

                  {/* Video Link */}
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Music2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">TikTok Videosu</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {userSubmission.tiktokUrl}
                        </p>
                      </div>
                    </div>
                    <a
                      href={userSubmission.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Görüntüle
                      </Button>
                    </a>
                  </div>

                  {/* Performance Metrics (if approved) */}
                  {userSubmission.status === "APPROVED" && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Performans Metrikleri</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(() => {
                          const userViews = userSubmission.lastViewCount || 0;
                          const userLikes = userSubmission.lastLikeCount || 0;
                          const userShares = userSubmission.lastShareCount || 0;
                          const userViewPoints = userViews * 0.01;
                          const userLikePoints = userLikes * 0.5;
                          const userSharePoints = userShares * 1.0;
                          const userTotalPoints = userViewPoints + userLikePoints + userSharePoints;

                          return (
                            <>
                              <div className="rounded-lg border p-4 text-center bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  <Eye className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Görüntülenme</span>
                                </div>
                                <div className="text-2xl font-bold mb-1">
                                  {formatNumber(userViews)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatNumber(userViewPoints)} tp
                                </div>
                              </div>
                              <div className="rounded-lg border p-4 text-center bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  <Heart className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Beğeni</span>
                                </div>
                                <div className="text-2xl font-bold mb-1">
                                  {formatNumber(userLikes)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatNumber(userLikePoints)} tp
                                </div>
                              </div>
                              <div className="rounded-lg border p-4 text-center bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  <Share2 className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Paylaşım</span>
                                </div>
                                <div className="text-2xl font-bold mb-1">
                                  {formatNumber(userShares)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatNumber(userSharePoints)} tp
                                </div>
                              </div>
                              <div className="rounded-lg border p-4 text-center bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  <Zap className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Toplam Puan</span>
                                </div>
                                <div className="text-2xl font-bold mb-1">
                                  {formatNumber(userTotalPoints)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  tp
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Katkı Payı</span>
                          <span className="text-2xl font-bold">
                            %{userSubmission.contributionPercent?.toFixed(2) || "0.00"}
                          </span>
                        </div>
                        {userSubmission.contributionPercent && (
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(userSubmission.contributionPercent, 100)}%` }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm font-medium text-muted-foreground">Tahmini Kazanç</span>
                          <span className="text-3xl font-bold text-primary">
                            {formatCurrency(Number(userSubmission.estimatedEarnings || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-primary/20 shadow-lg bg-gradient-to-br from-primary/5 to-background">
                <CardHeader>
                  <CardTitle className="text-2xl mb-2">
                    {canResubmit ? "Videonuzu Yeniden Gönderin" : "Videonuzu Gönderin"}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {canResubmit 
                      ? "Önceki gönderiniz reddedildi. Lütfen gereksinimleri karşılayan yeni bir video gönderin."
                      : "Bu şarkıyla bir TikTok videosu oluşturun ve para kazanmaya başlayın"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {canResubmit && userSubmission?.rejectionReason && (
                    <div className="mb-4 rounded-lg border-2 border-red-500/30 bg-red-50 dark:bg-red-950/30 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-700 dark:text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1.5">
                            Önceki Red Nedeni
                          </p>
                          <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                            {userSubmission.rejectionReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <SubmissionForm campaignId={campaign.id} tiktokHandle={userData?.tiktokHandle} />
                </CardContent>
              </Card>
            )}

            {/* Campaign Description */}
            {campaign.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Kampanya Açıklaması
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {campaign.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar (1/3) */}
          <div className="space-y-6">
            {/* Song Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music2 className="h-5 w-5" />
                  Şarkı Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{campaign.song.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {campaign.song.authorName || campaign.artist.name}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Süre: {formatDuration(campaign.song.duration)}</span>
                </div>

                {campaign.song.tiktokUrl && (
                  <a
                    href={campaign.song.tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" />
                      TikTok'ta Dinle
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Requirements Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Gereksinimler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaign.minFollowers ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Min. Takipçi</span>
                    </div>
                    <span className="font-semibold">{formatNumber(campaign.minFollowers)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Takipçi gereksinimi yok</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Min. Video Süresi</span>
                  </div>
                  <span className="font-semibold">{campaign.minVideoDuration || 15} saniye</span>
                </div>
              </CardContent>
            </Card>

            {/* Point System Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Puan Sistemi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-3">Puan Kazanma (tp)</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 rounded border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">İzlenme</span>
                      </div>
                      <span className="text-sm font-semibold">0.01 tp</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Beğeni</span>
                      </div>
                      <span className="text-sm font-semibold">0.5 tp</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Paylaşım</span>
                      </div>
                      <span className="text-sm font-semibold">1.0 tp</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <h4 className="font-semibold text-sm mb-2">Para Dağıtımı</h4>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>• Kazançlar puana göre hesaplanır</p>
                    <p>• Maksimum kazanç: <strong className="text-foreground">%40</strong> (Robin Hood Kuralı)</p>
                    <p>• Kesin kazançlar kampanya bitiminde hesaplanır</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
