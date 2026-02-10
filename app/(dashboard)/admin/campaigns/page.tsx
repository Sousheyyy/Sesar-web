import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle, XCircle } from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function AdminCampaignsPage() {
  await requireAdmin();

  const campaigns = await prisma.campaign.findMany({
    include: {
      song: true,
      artist: {
        select: {
          id: true,
          name: true,
          email: true,
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

  const pendingCampaigns = campaigns.filter((c) => c.status === "PENDING_APPROVAL");
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const completedCampaigns = campaigns.filter((c) => c.status === "COMPLETED");
  const cancelledCampaigns = campaigns.filter((c) => c.status === "CANCELLED");

  const renderCampaignList = (campaignList: typeof campaigns) => (
    <div className="space-y-2">
      {campaignList.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Kampanya bulunamadı</p>
      ) : (
        campaignList.map((campaign) => (
          <Link key={campaign.id} href={`/admin/campaigns/${campaign.id}`}>
            <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold">{campaign.title}</p>
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
                  >
                    {campaign.status === "ACTIVE" && "AKTİF"}
                    {campaign.status === "COMPLETED" && "TAMAMLANDI"}
                    {campaign.status === "PAUSED" && "DURAKLATILDI"}
                    {campaign.status === "PENDING_APPROVAL" && "ONAY BEKLİYOR"}
                    {campaign.status === "CANCELLED" && "İPTAL EDİLDİ"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {campaign.song.title} • {campaign.artist.name} tarafından
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Oluşturuldu: {formatDate(campaign.createdAt)} {campaign.endDate ? `• Bitiş: ${formatDate(campaign.endDate)}` : `• ${campaign.durationDays || 7} gün`}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="font-bold">
                  {formatCurrency(Number(campaign.remainingBudget))} /{" "}
                  {formatCurrency(Number(campaign.totalBudget))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {campaign._count.submissions} gönderi
                </p>
                <p className="text-sm text-muted-foreground">
                  Max Kazanç: {formatCurrency((Number(campaign.totalBudget) * (100 - (campaign.commissionPercent || 20)) / 100) * 0.4)}
                </p>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Kampanya Yönetimi</h2>
        <p className="text-muted-foreground">
          Kampanyaları görüntüleyin, onaylayın ve yönetin
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onay Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCampaigns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamamlandı</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCampaigns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İptal Edildi</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledCampaigns.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Onay Bekleyen ({pendingCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Aktif ({activeCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Tamamlandı ({completedCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            Tümü ({campaigns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Onay Bekleyen Kampanyalar</CardTitle>
              <CardDescription>
                Bu kampanyalar onay bekliyor ve henüz yayında değil
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderCampaignList(pendingCampaigns)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Aktif Kampanyalar</CardTitle>
              <CardDescription>
                Şu anda çalışan kampanyalar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderCampaignList(activeCampaigns)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Tamamlanan Kampanyalar</CardTitle>
              <CardDescription>
                Sona ermiş kampanyalar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderCampaignList(completedCampaigns)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Tüm Kampanyalar</CardTitle>
              <CardDescription>
                Platformdaki tüm kampanyalar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderCampaignList(campaigns)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


