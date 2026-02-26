"use client";

import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, Eye, FileText } from "lucide-react";
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
  maxItems?: number;
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  ACTIVE: "bg-green-500/20 text-green-300 border-green-500/30",
  COMPLETED: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

export const TopCampaignsTable = memo(function TopCampaignsTable({
  campaigns,
  maxItems = 10,
}: TopCampaignsTableProps) {
  const displayCampaigns = useMemo(() => campaigns.slice(0, maxItems), [campaigns, maxItems]);

  if (displayCampaigns.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-zinc-500">
        Henüz kampanya yok
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayCampaigns.map((campaign, index) => (
        <Link
          key={campaign.id}
          href={`/admin/campaigns/${campaign.id}`}
          className="block"
        >
          <div className="flex items-center gap-4 rounded-lg border border-white/5 p-3 hover:bg-white/5 transition-colors group">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-xs font-bold text-zinc-400 shrink-0">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-white text-sm truncate">{campaign.title}</p>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[campaign.status]}`}>
                  {STATUS_LABELS[campaign.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="text-zinc-500">Bütçe:</span> {formatCurrency(campaign.totalBudget)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {formatNumber(campaign.totalViews)}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {campaign.submissions}
                </span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
});
