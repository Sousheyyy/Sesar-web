"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { Music2, Plus, Clock, Video, TrendingUp, Loader2, AlertCircle } from "lucide-react";

interface Song {
  id: string;
  title: string;
  duration: number;
  genre?: string | null;
  description?: string | null;
  coverImage?: string | null;
  tiktokUrl?: string | null;
  tiktokMusicId?: string | null;
  videoCount?: number | null;
  authorName?: string | null;
  statsLastFetched?: Date | null;
  createdAt: Date;
  _count: {
    campaigns: number;
  };
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function MySongsPage() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      setError(null);
      const response = await fetch("/api/songs");
      if (!response.ok) throw new Error("Şarkılar yüklenirken bir hata oluştu");
      const json = await response.json();
      setSongs(json.data || []);
    } catch (err) {
      console.error("Error fetching songs:", err);
      setError(err instanceof Error ? err.message : "Şarkılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchSongs(); }}>
          Tekrar Dene
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Şarkılarım</h2>
          <p className="text-muted-foreground">
            Müzik kütüphanenizi yönetin
          </p>
        </div>
        <Link href="/artist/songs/upload">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Şarkı Yükle
          </Button>
        </Link>
      </div>

      {songs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Henüz şarkı yok</h3>
            <p className="text-muted-foreground text-center mb-4">
              Kampanya oluşturmaya başlamak için ilk şarkınızı yükleyin
            </p>
            <Link href="/artist/songs/upload">
              <Button>Şarkı Yükle</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {songs.map((song) => {
            const isTrending = song.videoCount && song.videoCount > 10000;

            return (
              <Card
                key={song.id}
                className="group cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                onClick={() => router.push(`/artist/songs/${song.id}`)}
              >
                <CardContent className="p-0">
                  {/* Cover Image */}
                  <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
                    {song.coverImage ? (
                      <Image
                        src={song.coverImage}
                        alt={song.title}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover transition-transform group-hover:scale-105"
                        unoptimized={song.coverImage.includes("tiktokcdn")}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Music2 className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    {/* Trending Badge Overlay */}
                    {isTrending && (
                      <div className="absolute top-1.5 right-1.5">
                        <Badge variant="default" className="gap-1 shadow-lg text-xs px-1.5 py-0.5">
                          <TrendingUp className="h-2.5 w-2.5" />
                          Trend
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Song Info */}
                  <div className="p-3 space-y-2">
                    <div>
                      <h3 className="font-semibold text-sm line-clamp-1">
                        {song.title}
                      </h3>
                      {song.authorName && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {song.authorName}
                        </p>
                      )}
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(song.duration)}
                      </div>
                      {song.videoCount && (
                        <div className="flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          {formatNumber(song.videoCount)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
