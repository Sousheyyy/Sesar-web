"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Music2, Eye, Heart, Share2, Users } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { TURKISH_MONTHS } from "./campaign-constants";
import type { Song } from "./types";

interface CampaignSummarySidebarProps {
  selectedSong: Song | null;
  title: string;
  durationDays: number;
  startDate: Date | null;
  endDate: Date | null;
  totalBudget: number;
  estimates: {
    minViews: number;
    maxViews: number;
    minLikes: number;
    maxLikes: number;
    minShares: number;
    maxShares: number;
  } | null;
  isLoading: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

function formatDateShort(date: Date) {
  return `${date.getDate()} ${TURKISH_MONTHS[date.getMonth()].slice(0, 3)}`;
}

export function CampaignSummarySidebar({
  selectedSong,
  title,
  durationDays,
  startDate,
  endDate,
  totalBudget,
  estimates,
  isLoading,
  canSubmit,
  onSubmit,
}: CampaignSummarySidebarProps) {
  return (
    <Card className="border-primary/20 shadow-lg sticky top-6">
      <CardContent className="space-y-5 pt-6">
        <h3 className="text-lg font-bold">Kampanya Özeti</h3>

        {/* Selected Song */}
        {selectedSong ? (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {selectedSong.coverImage ? (
                <img
                  src={selectedSong.coverImage}
                  alt={selectedSong.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Music2 className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{selectedSong.title}</p>
              <p className="text-xs text-muted-foreground truncate">{selectedSong.authorName || "Unknown Artist"}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-dashed">
            <Music2 className="h-5 w-5 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">Şarkı seçilmedi</span>
          </div>
        )}

        <Separator />

        {/* Details */}
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kampanya Adı</span>
            <span className="font-medium truncate max-w-[150px]">{title || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Süre</span>
            <span className="font-medium">{durationDays > 0 ? `${durationDays} Gün` : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tarih</span>
            <span className="font-medium">
              {startDate && endDate
                ? `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
                : "-"
              }
            </span>
          </div>
        </div>

        <Separator />

        {/* Budget */}
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Toplam Bütçe</span>
            <span className="font-medium">{totalBudget > 0 ? formatCurrency(totalBudget) : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sigorta</span>
            <span className="font-medium text-emerald-500">%100 havuz iadesi</span>
          </div>
        </div>

        <Separator />

        {/* Estimated Reach */}
        {estimates ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tahmini Erişim</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs text-muted-foreground">Erişim</span>
                </div>
                <span className="text-xs font-semibold">{formatNumber(estimates.minViews)} - {formatNumber(estimates.maxViews)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-pink-400" />
                  <span className="text-xs text-muted-foreground">Beğeni</span>
                </div>
                <span className="text-xs font-semibold">{formatNumber(estimates.minLikes)} - {formatNumber(estimates.maxLikes)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-xs text-muted-foreground">Paylaşım</span>
                </div>
                <span className="text-xs font-semibold">{formatNumber(estimates.minShares)} - {formatNumber(estimates.maxShares)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Users className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">Sınırsız Katılım</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-3 text-xs text-muted-foreground">
            Tahmini erişimi görmek için bütçe ve süre belirleyin
          </div>
        )}

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Toplam</span>
          <span className="text-primary">
            {totalBudget > 0 ? formatCurrency(totalBudget) : formatCurrency(0)}
          </span>
        </div>

        <Button
          type="button"
          onClick={onSubmit}
          disabled={isLoading || !canSubmit}
          className="w-full h-12 text-lg font-semibold shadow-md transition-all hover:shadow-lg hover:scale-[1.02]"
        >
          {isLoading ? "Oluşturuluyor..." : "Kampanyayı Başlat"}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          Kampanya, yönetici onayından sonra aktif olacaktır. Süre onay tarihinden itibaren başlar.
        </p>
      </CardContent>
    </Card>
  );
}
