import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { Music2, TrendingUp, Users, Calendar, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  const user = await requireAuth();

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      remainingBudget: {
        gt: 0,
      },
    },
    include: {
      song: true,
      artist: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      submissions: {
        where: {
          creatorId: user.id,
        },
        select: {
          id: true,
          status: true,
        },
      },
      _count: {
        select: {
          submissions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Pazar Yeri</h2>
        <p className="text-muted-foreground">
          Aktif kampanyalara göz atın ve kazanmaya başlayın
        </p>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aktif kampanya yok</h3>
            <p className="text-muted-foreground text-center">
              Yeni tanıtım fırsatları için daha sonra tekrar kontrol edin
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {campaigns.map((campaign) => {
            const userSubmission = campaign.submissions[0];
            const hasParticipated = !!userSubmission;
            const submissionStatus = userSubmission?.status;

            return (
              <Link key={campaign.id} href={`/dashboard/marketplace/${campaign.id}`}>
                <Card 
                  className={`hover:bg-accent transition-colors cursor-pointer h-full ${
                    hasParticipated 
                      ? submissionStatus === "APPROVED"
                        ? "border-2 border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                        : submissionStatus === "REJECTED"
                        ? "border-2 border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
                        : "border-2 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20"
                      : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex gap-4">
                       {/* Cover Art */}
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                        {campaign.song.coverImage ? (
                          <Image
                            src={campaign.song.coverImage}
                            alt={campaign.song.title}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Music2 className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <CardTitle className="line-clamp-1 text-base">{campaign.song.title}</CardTitle>
                        <CardDescription className="line-clamp-1 mt-1">
                          {campaign.song.authorName || campaign.artist.name}
                        </CardDescription>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {campaign.title}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Max Kazanç:</span>
                      <span className="font-bold text-lg text-primary">
                        {formatCurrency((Number(campaign.totalBudget) * (100 - campaign.platformFeePercent - campaign.safetyReservePercent) / 100) * 0.4)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gönderiler:</span>
                      <span className="font-medium">{campaign._count.submissions}</span>
                    </div>
                  </div>

                  {/* Campaign Dates */}
                  <div className="pt-2 border-t space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-muted-foreground">Başlangıç: </span>
                        <span className="font-medium">{formatDate(campaign.startDate)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-muted-foreground">Bitiş: </span>
                        <span className="font-medium">{formatDate(campaign.endDate)}</span>
                      </div>
                    </div>
                  </div>

                  {(campaign.minFollowers || campaign.minVideoDuration) && (
                    <div className="pt-2 border-t space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Gereksinimler:
                      </p>
                      {campaign.minFollowers && (
                        <div className="flex items-center gap-2 text-xs">
                          <Users className="h-3 w-3" />
                          <span>Min. {formatNumber(campaign.minFollowers)} takipçi</span>
                        </div>
                      )}
                      {campaign.minVideoDuration && (
                        <div className="flex items-center gap-2 text-xs">
                          <TrendingUp className="h-3 w-3" />
                          <span>Min. {campaign.minVideoDuration}sn video</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Badges at Bottom */}
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <Badge variant="success" className="shrink-0">AKTİF</Badge>
                    {hasParticipated && (
                      <Badge
                        variant={
                          submissionStatus === "APPROVED"
                            ? "success"
                            : submissionStatus === "REJECTED"
                            ? "destructive"
                            : "warning"
                        }
                        className="text-xs px-2 py-1"
                      >
                        {submissionStatus === "APPROVED" && (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            KATILDI
                          </>
                        )}
                        {submissionStatus === "REJECTED" && (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            REDDEDİLDİ
                          </>
                        )}
                        {submissionStatus === "PENDING" && (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            BEKLEMEDE
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
