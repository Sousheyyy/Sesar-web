"use client";

import { useState, memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music2, Video, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface MusicStatsProps {
  songId: string;
  initialStats?: {
    videoCount?: number | null; // Number of videos using this music (from TikAPI)
    authorName?: string | null;
    statsLastFetched?: Date | null;
  };
}

export const MusicStats = memo(function MusicStats({ 
  songId, 
  initialStats
}: MusicStatsProps) {
  const [stats] = useState(initialStats);

  const formatLastUpdated = (date: Date | null | undefined) => {
    if (!date) return "Hiç";
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Az önce";
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} s önce`;
    if (diffDays < 30) return `${diffDays} g önce`;
    return new Date(date).toLocaleDateString('tr-TR');
  };

  const hasStats = stats?.videoCount;
  const isTrending = stats?.videoCount && stats.videoCount > 10000;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Müzik İstatistikleri
          </CardTitle>
          <CardDescription>
            {hasStats 
              ? `Son güncelleme: ${formatLastUpdated(stats?.statsLastFetched)}`
              : "TikTok performans metrikleri"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!hasStats ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="mb-2">Henüz istatistik yok</p>
            <p className="text-sm">İstatistikler şarkı TikTok müzik kimliği ile yüklendikten sonra mevcut olacaktır</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Trending Badge */}
            {isTrending && (
              <div className="flex justify-center">
                <Badge variant="default" className="gap-2">
                  <TrendingUp className="h-3 w-3" />
                  TikTok'ta Trend
                </Badge>
              </div>
            )}

            {/* Video Count - From TikAPI */}
            {stats?.videoCount !== null && stats?.videoCount !== undefined && (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="rounded-full bg-primary/10 p-2">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatNumber(stats.videoCount)}
                  </p>
                  <p className="text-xs text-muted-foreground">TikTok'ta Oluşturulan Video</p>
                </div>
              </div>
            )}

            {/* Author Info */}
            {stats?.authorName && (
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-sm text-muted-foreground">Orijinal Sanatçı</p>
                <p className="font-medium">{stats.authorName}</p>
              </div>
            )}

            {/* Popularity Indicator */}
            {stats?.videoCount && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Popülerlik</span>
                  <span>
                    {stats.videoCount < 1000 && "Başlangıç"}
                    {stats.videoCount >= 1000 && stats.videoCount < 10000 && "Büyüyen"}
                    {stats.videoCount >= 10000 && stats.videoCount < 50000 && "Popüler"}
                    {stats.videoCount >= 50000 && "Viral"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((stats.videoCount / 50000) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

