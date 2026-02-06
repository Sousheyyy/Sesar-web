import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireArtist } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ArrowLeft, Music2, TrendingUp, Users, Clock, Calendar, Target, Zap, Info } from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import { MusicStats } from "@/components/music/music-stats";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { SubmissionsTable } from "@/components/submissions/submissions-table";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireArtist();

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
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

  const totalViews = campaign.submissions.reduce(
    (sum, sub) => sum + sub.lastViewCount,
    0
  );
  
  // Calculate creator pool (distributable budget after fees)
  const creatorPoolPercent = 100 - campaign.platformFeePercent - campaign.safetyReservePercent;
  const creatorPool = (Number(campaign.totalBudget) * creatorPoolPercent) / 100;

  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Impact Score & Robin Hood Cap Logic (Mirrored from Admin Page) ---
  
  // 1. Calculate Scores for each submission
  const submissionScores = campaign.submissions.map(sub => {
    const views = sub.lastViewCount || 0;
    const likes = sub.lastLikeCount || 0;
    const shares = sub.lastShareCount || 0;
    
    // Weights: Views (0.01), Likes (0.5), Shares (1.0)
    const score = (views * 0.01) + (likes * 0.5) + (shares * 1.0);
    
    return {
      ...sub,
      score,
      totalEarnings: Number(sub.totalEarnings),
      estimatedEarnings: Number(sub.estimatedEarnings),
      payoutAmount: sub.payoutAmount ? Number(sub.payoutAmount) : null,
    };
  });

  const totalCampaignScore = submissionScores.reduce((acc, sub) => acc + sub.score, 0);

  // 2. Calculate Initial Shares & Identify Capped Users
  // Identify who needs capping (share > 40%)
  const submissionsWithInitialShare = submissionScores.map(sub => {
    const rawShare = totalCampaignScore > 0 ? sub.score / totalCampaignScore : 0;
    const isCapped = rawShare > 0.40;
    return { ...sub, rawShare, isCapped };
  });

  // 3. Apply Cap and Redistribute
  const cappedPoolAmount = creatorPool * 0.40;
  
  // First pass: Assign capped amounts
  const finalSubmissions = submissionsWithInitialShare.map(sub => {
    if (sub.isCapped) {
      return {
        ...sub,
        calculatedEarnings: cappedPoolAmount,
        contributionPercent: (sub.score / totalCampaignScore) * 100
      };
    }
    return {
      ...sub,
      calculatedEarnings: 0, // Placeholder
      contributionPercent: (sub.score / totalCampaignScore) * 100
    };
  });

  // Calculate how much pool is used by capped users
  const usedPool = finalSubmissions.reduce((acc, sub) => acc + sub.calculatedEarnings, 0);
  const distributableRemainder = creatorPool - usedPool;
  
  // Calculate total score of non-capped users
  const nonCappedScore = finalSubmissions
    .filter(sub => !sub.isCapped)
    .reduce((acc, sub) => acc + sub.score, 0);

  // Second pass: Distribute remainder to non-capped users
  const fullyCalculatedSubmissions = finalSubmissions.map(sub => {
    // If we already calculated earnings (capped users), return as is
    if (sub.calculatedEarnings > 0) {
      return {
        ...sub,
        estimatedEarnings: sub.calculatedEarnings
      };
    }
    
    // For non-capped users, distribute remainder pro-rata based on their score relative to other non-capped users
    const shareOfRemainder = nonCappedScore > 0 ? sub.score / nonCappedScore : 0;
    const earnings = shareOfRemainder * distributableRemainder;
    
    return {
      ...sub,
      estimatedEarnings: earnings
    };
  });

  // Format for table
  const formattedSubmissions = fullyCalculatedSubmissions.map((sub) => ({
    ...sub,
    totalEarnings: sub.totalEarnings > 0 ? sub.totalEarnings : sub.estimatedEarnings,
    estimatedEarnings: sub.estimatedEarnings,
    contributionPercent: sub.contributionPercent,
    contributionPoints: sub.score, // Pass the calculated score as contribution points
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/artist/campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{campaign.title}</h2>
            <p className="text-muted-foreground">{campaign.song.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              campaign.status === "ACTIVE"
                ? "success"
                : campaign.status === "COMPLETED"
                ? "secondary"
                : campaign.status === "PENDING_APPROVAL"
                ? "warning"
                : campaign.status === "CANCELLED"
                ? "destructive"
                : campaign.status === "PAUSED"
                ? "warning"
                : "warning"
            }
          >
            {campaign.status === "ACTIVE" && "AKTİF"}
            {campaign.status === "PENDING_APPROVAL" && "ONAY BEKLİYOR"}
            {campaign.status === "COMPLETED" && "TAMAMLANDI"}
            {campaign.status === "PAUSED" && "DURAKLATILDI"}
            {campaign.status === "CANCELLED" && "İPTAL EDİLDİ"}
          </Badge>
          <CampaignActions campaignId={campaign.id} currentStatus={campaign.status} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Toplam Bütçe</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-0 pb-4">
            <div className="text-2xl font-bold mb-2">
              {formatCurrency(Number(campaign.totalBudget))}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Platform ({campaign.platformFeePercent}%)</span>
                <span>-{formatCurrency((Number(campaign.totalBudget) * campaign.platformFeePercent) / 100)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Rezerv ({campaign.safetyReservePercent}%)</span>
                <span>-{formatCurrency((Number(campaign.totalBudget) * campaign.safetyReservePercent) / 100)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t font-semibold text-primary">
                <span>Dağıtılabilir</span>
                <span>{formatCurrency(creatorPool)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Gönderiler</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-0 pb-4">
            <div className="text-2xl font-bold mb-1">{campaign.submissions.length}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.submissions.filter((s) => s.status === "APPROVED").length} onaylandı
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Toplam Görüntülenme</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-0 pb-4">
            <div className="text-2xl font-bold mb-1">{formatNumber(totalViews)}</div>
            <p className="text-xs text-muted-foreground">Tüm videolarda</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Toplam Puan</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-0 pb-4">
            <div className="text-2xl font-bold mb-1">{formatNumber(totalCampaignScore)} tp</div>
            <p className="text-xs text-muted-foreground">Tüm gönderilerden</p>
          </CardContent>
        </Card>
      </div>

      {/* Music Performance Section */}
      {campaign.song.tiktokMusicId && (
        <MusicStats
          songId={campaign.song.id}
          initialStats={{
            videoCount: campaign.song.videoCount,
            authorName: campaign.song.authorName,
            statsLastFetched: campaign.song.statsLastFetched,
          }}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Song Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="h-5 w-5" />
              Şarkı Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Album Cover */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border-2 border-muted bg-muted">
              {campaign.song.coverImage ? (
                <Image
                  src={campaign.song.coverImage}
                  alt={campaign.song.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Music2 className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Song Details */}
            <div className="space-y-3 pt-2">
              <div>
                <h3 className="font-semibold text-lg line-clamp-1">{campaign.song.title}</h3>
                <p className="text-sm text-muted-foreground">{campaign.song.authorName || campaign.artist.name}</p>
              </div>

              <div className="space-y-2">
                {campaign.song.duration !== null && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(campaign.song.duration)}</span>
                  </div>
                )}
              </div>

              {campaign.song.tiktokUrl && (
                <a
                  href={campaign.song.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Music2 className="h-4 w-4" />
                    TikTok'ta Dinle
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaign Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kampanya Detayları</CardTitle>
            <CardDescription>
              Kampanya ayarları ve gereksinimler
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            {campaign.description && (
              <div className="rounded-lg bg-muted/50 p-4 border">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Kampanya Açıklaması
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {campaign.description}
                </p>
              </div>
            )}

            {/* Campaign Settings Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Budget Info */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TLIcon className="h-4 w-4 text-primary" />
                  Bütçe Bilgileri
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">İçerik Üreticisi Havuzu</span>
                    <span className="font-semibold">{formatCurrency(creatorPool)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Max Kazanç</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(Number(creatorPool * 0.4))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Creator Requirements */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-primary" />
                  İçerik Üretici Kriterleri
                </div>
                <div className="space-y-2">
                  {campaign.minFollowers ? (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Min. Takipçi</span>
                      <span className="font-semibold">{campaign.minFollowers.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Min. Takipçi</span>
                      <span className="font-semibold text-muted-foreground">Yok</span>
                    </div>
                  )}
                  {campaign.minVideoDuration ? (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Min. Video Süresi</span>
                      <span className="font-semibold">{campaign.minVideoDuration} saniye</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Min. Video Süresi</span>
                      <span className="font-semibold text-muted-foreground">Yok</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Point System & Distribution Info */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-primary" />
                Puan Sistemi ve Dağıtım
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <h5 className="font-semibold mb-2">Puan Kazanma (tp)</h5>
                  <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>İzlenme: <strong className="text-foreground">1 izlenme = 0.01 tp</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>Beğeni: <strong className="text-foreground">1 beğeni = 0.5 tp</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>Paylaşım: <strong className="text-foreground">1 paylaşım = 1.0 tp</strong></span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <h5 className="font-semibold mb-2">Para Dağıtımı</h5>
                  <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>Kazançlar, her üreticinin toplam puana katkısına göre hesaplanır</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>Robin Hood Kuralı: Bir üretici <strong className="text-foreground">maksimum %40</strong> kazanabilir</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>%40'ı aşan kısım, diğer üreticilere orantılı olarak dağıtılır</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>Kesin kazançlar kampanya bitiminde hesaplanır</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                Zaman Çizelgesi
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Oluşturulma Tarihi</span>
                  <span className="text-sm font-medium">{formatDate(campaign.createdAt)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Başlangıç Tarihi</span>
                  <span className="text-sm font-medium">{formatDate(campaign.startDate)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Bitiş Tarihi</span>
                  <span className="text-sm font-medium">{formatDate(campaign.endDate)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Durum</span>
                  <div className="mt-1">
                    <Badge
                      variant={
                        campaign.status === "ACTIVE"
                          ? "success"
                          : campaign.status === "COMPLETED"
                          ? "secondary"
                          : "warning"
                      }
                    >
                      {campaign.status === "ACTIVE" && "AKTİF"}
                      {campaign.status === "COMPLETED" && "TAMAMLANDI"} 
                      {campaign.status === "PENDING_APPROVAL" && "ONAY BEKLİYOR"}
                      {campaign.status === "PAUSED" && "DURDURULDU"}
                      {campaign.status === "CANCELLED" && "İPTAL EDİLDİ"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gönderiler</CardTitle>
          <CardDescription>
            Bu kampanya için içerik üreticiler tarafından gönderilen videolar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubmissionsTable submissions={formattedSubmissions} />
        </CardContent>
      </Card>
    </div>
  );
}
