"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link as LinkIcon, Music2, Loader2, Video, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface SongUploadProps {
  onSuccess?: (song: any) => void;
  variant?: "default" | "plain";
  showHeader?: boolean;
}

interface SongPreview {
  id: string;
  title: string;
  duration: number;
  coverImage?: string;
  videoCount?: number | null; // Number of videos using this music (from TikAPI)
  authorName?: string | null;
}

export function SongUpload({ onSuccess, variant = "default", showHeader = true }: SongUploadProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [songPreview, setSongPreview] = useState<SongPreview | null>(null);
    const [formData, setFormData] = useState({
    tiktokUrl: "",
  });

  const handleFetchDetails = async () => {
    if (!formData.tiktokUrl) {
      toast.error("Lütfen bir TikTok linki girin");
      return;
    }

    if (!formData.tiktokUrl.includes("tiktok.com")) {
      toast.error("Geçerli bir TikTok linki girin");
      return;
    }

    setIsFetching(true);

    try {
      const response = await fetch("/api/songs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktokUrl: formData.tiktokUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Şarkı detayları alınamadı");
      }

      const data = await response.json();

      // Set preview with enhanced statistics
      setSongPreview({
        id: data.id,
        title: data.title,
        duration: data.duration,
        coverImage: data.coverImage,
        videoCount: data.videoCount,
        authorName: data.authorName,
      });

      toast.success("Şarkı başarıyla eklendi!");
      
      if (onSuccess) {
        onSuccess(data);
      } else {
        router.push("/artist/campaigns/new");
        router.refresh();
      }
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error(error.message || "Şarkı detayları alınamadı");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleFetchDetails();
  };

  const Content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tiktokUrl">TikTok Linki *</Label>
        <div className="flex gap-2">
          <Input
            id="tiktokUrl"
            placeholder="https://vt.tiktok.com/..."
            value={formData.tiktokUrl}
            onChange={(e) => setFormData({ ...formData, tiktokUrl: e.target.value })}
            required
            disabled={isFetching || isUploading}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Şarkının TikTok müzik sayfası veya şarkıyı kullanan bir video linki
        </p>
      </div>

      {songPreview && (
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center gap-3">
            {songPreview.coverImage && (
              <img 
                src={songPreview.coverImage} 
                alt={songPreview.title}
                className="h-20 w-20 rounded object-cover"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold">{songPreview.title}</h4>
                {songPreview.videoCount && songPreview.videoCount > 10000 && (
                  <Badge variant="default" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Trend
                  </Badge>
                )}
              </div>
              {songPreview.authorName && (
                <p className="text-sm text-muted-foreground mb-2">
                  {songPreview.authorName}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Süre: {Math.floor(songPreview.duration / 60)}:{(songPreview.duration % 60).toString().padStart(2, '0')}
              </p>
            </div>
          </div>

          {/* Video Count Statistics - From TikAPI */}
          {songPreview.videoCount !== null && songPreview.videoCount !== undefined && (
            <div className="pt-3 border-t">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary/10 p-2">
                  <Video className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {formatNumber(songPreview.videoCount)}
                  </p>
                  <p className="text-xs text-muted-foreground">TikTok'ta Oluşturulan Video</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-center">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              ✓ Şarkı başarıyla eklendi! Kampanya oluşturmaya hazır.
            </p>
          </div>
        </div>
      )}

      <Button 
        type="submit" 
        disabled={isFetching || isUploading || !formData.tiktokUrl} 
        className="w-full gap-2"
      >
        {isFetching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Şarkı ekleniyor...
          </>
        ) : (
          <>
            <LinkIcon className="h-4 w-4" />
            Şarkı Ekle
          </>
        )}
      </Button>
    </form>
  );

  if (variant === "plain") {
    return (
      <div className="space-y-4">
         {showHeader && (
            <div className="space-y-1.5 p-6 pl-0 pt-0">
                <h3 className="font-semibold leading-none tracking-tight">Şarkı Ekle</h3>
                <p className="text-sm text-muted-foreground">TikTok müzik veya video linkini yapıştırarak şarkınızı ekleyin</p>
            </div>
         )}
         {Content}
      </div>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle>Şarkı Ekle</CardTitle>
          <CardDescription>
            TikTok müzik veya video linkini yapıştırarak şarkınızı ekleyin
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        {Content}
      </CardContent>
    </Card>
  );
}
