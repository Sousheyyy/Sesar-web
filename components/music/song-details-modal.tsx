"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Music2,
  Clock,
  Video,
  TrendingUp,
  ExternalLink,
  Calendar,
  User,
  Trash2,
  Loader2,
} from "lucide-react";
import { formatNumber, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Song {
  id: string;
  title: string;
  duration: number;
  genre?: string | null;
  description?: string | null;
  coverImage?: string | null;
  tiktokUrl?: string | null;
  tiktokMusicId?: string | null;
  videoCount?: number | null; // Number of videos using this music (from TikAPI)
  authorName?: string | null;
  statsLastFetched?: Date | null;
  createdAt: Date;
  _count?: {
    campaigns: number;
  };
}

interface SongDetailsModalProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (songId: string) => void;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function SongDetailsModal({
  song,
  open,
  onOpenChange,
  onDelete,
}: SongDetailsModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!song) return null;

  const hasStats = song.videoCount;
  const isTrending = song.videoCount && song.videoCount > 10000;

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/songs/${song.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete song");
      }

      toast.success("Şarkı başarıyla silindi");
      onOpenChange(false);
      
      if (onDelete) {
        onDelete(song.id);
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Şarkı silinemedi");
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Music2 className="h-6 w-6 text-primary" />
            {song.title}
          </DialogTitle>
          {song.authorName && (
            <DialogDescription className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              {song.authorName}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Cover Image & Genre */}
          <div className="flex items-start gap-4">
            {song.coverImage ? (
              <img
                src={song.coverImage}
                alt={song.title}
                className="h-32 w-32 rounded-lg object-cover shadow-md"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-muted">
                <Music2 className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              {isTrending && (
                <Badge variant="default" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  TikTok'ta Trend
                </Badge>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatDuration(song.duration)}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {song.description && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 font-semibold">Açıklama</h4>
                <p className="text-sm text-muted-foreground">
                  {song.description}
                </p>
              </div>
            </>
          )}

          {/* TikTok Statistics */}
          {hasStats && (
            <>
              <Separator />
              <div>
                <h4 className="mb-3 font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  TikTok İstatistikleri
                </h4>
                {/* Video Count - From TikAPI */}
                {song.videoCount !== null && song.videoCount !== undefined && (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {formatNumber(song.videoCount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        TikTok'ta Oluşturulan Video
                      </p>
                    </div>
                  </div>
                )}
                {song.statsLastFetched && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Son güncelleme: {formatDate(song.statsLastFetched)}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Popularity Indicator */}
          {song.videoCount && (
            <>
              <div>
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Popülerlik</span>
                  <span>
                    {song.videoCount < 1000 && "Başlangıç"}
                    {song.videoCount >= 1000 && song.videoCount < 10000 && "Büyüyen"}
                    {song.videoCount >= 10000 && song.videoCount < 50000 && "Popüler"}
                    {song.videoCount >= 50000 && "Viral"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((song.videoCount / 50000) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Kampanyalar</span>
              <span className="font-medium">
                {song._count?.campaigns || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Yüklenme Tarihi</span>
              <span className="font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(song.createdAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <Separator />
          <div className="space-y-2">
            {song.tiktokUrl && (
              <a
                href={song.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="default" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" />
                  TikTok'ta Aç
                </Button>
              </a>
            )}
            
            {/* Delete Button */}
            {!showConfirm ? (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                Şarkıyı Sil
              </Button>
            ) : (
              <div className="space-y-2 rounded-lg border border-destructive p-3">
                <p className="text-sm font-medium text-center">
                  Bu şarkıyı silmek istediğinizden emin misiniz?
                </p>
                {song._count && song._count.campaigns > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Uyarı: Bu şarkı {song._count.campaigns} kampanyada kullanılıyor
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancelDelete}
                    disabled={isDeleting}
                  >
                    İptal
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Siliniyor...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Silmeyi Onayla
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

