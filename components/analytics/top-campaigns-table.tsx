"use client";

import { memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CampaignStatus } from "@prisma/client";

interface TopCampaign {
  id: string;
  title: string;
  status: CampaignStatus;
  totalBudget: number;
  submissions: number;
  totalViews: number;
  createdAt: Date;
}

interface TopCampaignsTableProps {
  campaigns: TopCampaign[];
  title?: string;
  description?: string;
  maxItems?: number;
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
  PENDING_APPROVAL: "Onay Bekliyor",
  PAUSED: "Duraklatıldı",
  CANCELLED: "İptal Edildi",
  REJECTED: "Reddedildi",
};

const STATUS_VARIANTS: Record<CampaignStatus, "success" | "secondary" | "warning" | "destructive" | "default"> = {
  ACTIVE: "success",
  COMPLETED: "secondary",
  PENDING_APPROVAL: "warning",
  PAUSED: "warning",
  CANCELLED: "destructive",
  REJECTED: "destructive",
};

export const TopCampaignsTable = memo(function TopCampaignsTable({
  campaigns,
  title = "En İyi Performans Gösteren Kampanyalar",
  description = "En yüksek görüntülenme ve bütçeye sahip kampanyalar",
  maxItems = 10,
}: TopCampaignsTableProps) {
  const displayCampaigns = useMemo(() => campaigns.slice(0, maxItems), [campaigns, maxItems]);

  if (displayCampaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Henüz kampanya yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {displayCampaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/admin/campaigns/${campaign.id}`}
              className="block"
            >
              <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{campaign.title}</p>
                    <Badge variant={STATUS_VARIANTS[campaign.status]}>
                      {STATUS_LABELS[campaign.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Bütçe: {formatCurrency(campaign.totalBudget)}</span>
                    <span>•</span>
                    <span>{formatNumber(campaign.totalViews)} görüntülenme</span>
                    <span>•</span>
                    <span>{campaign.submissions} gönderi</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(campaign.createdAt)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

