import Link from "next/link";
import Image from "next/image";
import { requireArtist } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Music2, Plus, Calendar, Users, TrendingUp, Eye, Heart, Share2, Target } from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function ArtistCampaignsPage() {
  const user = await requireArtist();

  // Fetch artist's active campaigns
  const activeCampaigns = await prisma.campaign.findMany({
    where: {
      artistId: user.id,
      status: "ACTIVE",
    },
    include: {
      song: true,
      _count: {
        select: {
          submissions: true,
        },
      },
      submissions: {
        select: {
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Fetch artist's ended campaigns
  const endedCampaigns = await prisma.campaign.findMany({
    where: {
      artistId: user.id,
      status: {
        in: ["COMPLETED", "CANCELLED"],
      },
    },
    include: {
      song: true,
      _count: {
        select: {
          submissions: true,
        },
      },
      submissions: {
        select: {
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true,
        },
      },
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  // Fetch all marketplace campaigns (from all artists)
  const allMarketplaceCampaigns = await prisma.campaign.findMany({
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
      _count: {
        select: {
          submissions: true,
        },
      },
      submissions: {
        select: {
          lastViewCount: true,
          lastLikeCount: true,
          lastShareCount: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Helper function to calculate total engagement
  const calculateEngagement = (submissions: Array<{ lastViewCount: number | null; lastLikeCount: number | null; lastShareCount: number | null }>) => {
    return submissions.reduce((acc, sub) => ({
      views: acc.views + (sub.lastViewCount || 0),
      likes: acc.likes + (sub.lastLikeCount || 0),
      shares: acc.shares + (sub.lastShareCount || 0),
    }), { views: 0, likes: 0, shares: 0 });
  };

  // Campaign Card Component
  const CampaignCard = ({ campaign, isMarketplace = false }: { campaign: any; isMarketplace?: boolean }) => {
    const engagement = calculateEngagement(campaign.submissions);
    const maxEarnings = (Number(campaign.totalBudget) * (100 - campaign.platformFeePercent - campaign.safetyReservePercent) / 100) * 0.4;
    
    return (
      <Link key={campaign.id} href={`/artist/campaigns/${campaign.id}`}>
        <Card className="group hover:shadow-lg hover:border-purple-500/30 transition-all duration-300 cursor-pointer h-full bg-[#0A0A0B]/40 border-white/10 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex gap-4">
              {/* Cover Art */}
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 group-hover:scale-105 transition-transform duration-300">
                {campaign.song.coverImage ? (
                  <Image
                    src={campaign.song.coverImage}
                    alt={campaign.song.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Music2 className="h-10 w-10 text-white/20" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <CardTitle className="line-clamp-1 text-base text-white group-hover:text-purple-300 transition-colors">
                    {campaign.song.title}
                  </CardTitle>
                  <Badge
                    variant={
                      campaign.status === "ACTIVE"
                        ? "success"
                        : campaign.status === "COMPLETED"
                        ? "secondary"
                        : campaign.status === "PENDING_APPROVAL"
                        ? "warning"
                        : "destructive"
                    }
                    className="shrink-0"
                  >
                    {campaign.status === "ACTIVE" && "AKTİF"}
                    {campaign.status === "PENDING_APPROVAL" && "ONAY BEKLİYOR"}
                    {campaign.status === "COMPLETED" && "TAMAMLANDI"}
                    {campaign.status === "PAUSED" && "DURAKLATILDI"}
                    {campaign.status === "CANCELLED" && "İPTAL"}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-1 text-white/60">
                  {campaign.song.authorName || (isMarketplace ? campaign.artist.name : campaign.title)}
                </CardDescription>
                {isMarketplace && (
                  <p className="text-xs text-white/40 mt-1 line-clamp-1">
                    {campaign.title}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {/* Budget Info */}
            <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
              <div>
                <p className="text-xs text-white/50 mb-0.5">Bütçe</p>
                <p className="text-sm font-semibold text-white">
                  {formatCurrency(Number(campaign.remainingBudget))}
                </p>
                <p className="text-xs text-white/40">
                  / {formatCurrency(Number(campaign.totalBudget))}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-0.5">Max Kazanç</p>
                <p className="text-sm font-semibold text-purple-400">
                  {formatCurrency(maxEarnings)}
                </p>
              </div>
            </div>

            {/* Engagement Stats */}
            {campaign.submissions.length > 0 && (
              <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Eye className="h-3 w-3 text-white/40" />
                  </div>
                  <p className="text-xs font-semibold text-white">
                    {formatNumber(engagement.views)}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Heart className="h-3 w-3 text-white/40" />
                  </div>
                  <p className="text-xs font-semibold text-white">
                    {formatNumber(engagement.likes)}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Share2 className="h-3 w-3 text-white/40" />
                  </div>
                  <p className="text-xs font-semibold text-white">
                    {formatNumber(engagement.shares)}
                  </p>
                </div>
              </div>
            )}

            {/* Meta Info */}
            <div className="flex items-center justify-between text-xs text-white/50 pt-1 border-t border-white/5">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{campaign._count.submissions} katılımcı</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(campaign.createdAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Kampanyalarım</h2>
          <p className="text-white/60">
            Tanıtım kampanyalarınızı yönetin ve tüm aktif kampanyaları keşfedin
          </p>
        </div>
        <Link href="/artist/campaigns/new">
          <Button className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-0">
            <Plus className="h-4 w-4" />
            Kampanya Oluştur
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="aktif" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-white/5 border border-white/10">
          <TabsTrigger 
            value="aktif" 
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            Aktif ({activeCampaigns.length})
          </TabsTrigger>
          <TabsTrigger 
            value="sonlanan"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            Sonlanan ({endedCampaigns.length})
          </TabsTrigger>
          <TabsTrigger 
            value="tumu"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            Tümü ({allMarketplaceCampaigns.length})
          </TabsTrigger>
        </TabsList>

        {/* Aktif Tab */}
        <TabsContent value="aktif" className="mt-6">
          {activeCampaigns.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-white/20 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-white">Aktif kampanya yok</h3>
                <p className="text-white/60 text-center mb-4">
                  Müziğinizi tanıtmaya başlamak için ilk kampanyanızı oluşturun
                </p>
                <Link href="/artist/campaigns/new">
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    Kampanya Oluştur
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sonlanan Tab */}
        <TabsContent value="sonlanan" className="mt-6">
          {endedCampaigns.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-white/20 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-white">Sonlanan kampanya yok</h3>
                <p className="text-white/60 text-center">
                  Tamamlanmış veya iptal edilmiş kampanyalarınız burada görünecek
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {endedCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tümü (All Marketplace) Tab */}
        <TabsContent value="tumu" className="mt-6">
          {allMarketplaceCampaigns.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Music2 className="h-12 w-12 text-white/20 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-white">Aktif kampanya yok</h3>
                <p className="text-white/60 text-center">
                  Şu anda platformda aktif kampanya bulunmuyor
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allMarketplaceCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} isMarketplace={true} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
