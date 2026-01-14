import Link from "next/link";
import { requireArtist } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Music2, Plus } from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function ArtistCampaignsPage() {
  const user = await requireArtist();

  const campaigns = await prisma.campaign.findMany({
    where: {
      artistId: user.id,
    },
    include: {
      song: true,
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kampanyalarım</h2>
          <p className="text-muted-foreground">
            Tanıtım kampanyalarınızı yönetin
          </p>
        </div>
        <Link href="/artist/campaigns/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Kampanya Oluştur
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Henüz kampanya yok</h3>
            <p className="text-muted-foreground text-center mb-4">
              Müziğinizi tanıtmaya başlamak için ilk kampanyanızı oluşturun
            </p>
            <Link href="/artist/campaigns/new">
              <Button>Kampanya Oluştur</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/artist/campaigns/${campaign.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-1">{campaign.title}</CardTitle>
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
                          : "warning"
                      }
                    >
                      {campaign.status === "ACTIVE" && "AKTİF"}
                      {campaign.status === "PENDING_APPROVAL" && "ONAY BEKLİYOR"}
                      {campaign.status === "COMPLETED" && "TAMAMLANDI"}
                      {campaign.status === "PAUSED" && "DURAKLATILDI"}
                      {campaign.status === "CANCELLED" && "İPTAL EDİLDİ"}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-1">
                    {campaign.song.title}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bütçe:</span>
                    <span className="font-medium">
                      {formatCurrency(Number(campaign.remainingBudget))} /{" "}
                      {formatCurrency(Number(campaign.totalBudget))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Max Kazanç:</span>
                    <span className="font-medium">
                      {formatCurrency((Number(campaign.totalBudget) * (100 - campaign.platformFeePercent - campaign.safetyReservePercent) / 100) * 0.4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gönderiler:</span>
                    <span className="font-medium">{campaign._count.submissions}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Oluşturuldu:</span>
                    <span className="font-medium">
                      {formatDate(campaign.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


