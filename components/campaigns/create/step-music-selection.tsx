"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongUpload } from "@/components/upload/song-upload";
import { Music2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Song } from "./types";

const ITEMS_PER_PAGE = 6;

interface StepMusicSelectionProps {
  songs: Song[];
  selectedSongId: string;
  onSelectSong: (id: string) => void;
  onSongUploaded: (song: Song) => void;
}

export function StepMusicSelection({ songs, selectedSongId, onSelectSong, onSongUploaded }: StepMusicSelectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isSongDialogOpen, setIsSongDialogOpen] = useState(false);

  const totalPages = Math.ceil(songs.length / ITEMS_PER_PAGE);
  const displayedSongs = songs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSongUploaded = (song: Song) => {
    onSongUploaded(song);
    setIsSongDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">1</span>
          Müzik Seçimi
        </h3>
        <Dialog open={isSongDialogOpen} onOpenChange={setIsSongDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-primary hover:text-primary/80">
              + Yeni Şarkı Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Şarkı Ekle</DialogTitle>
            </DialogHeader>
            <SongUpload onSuccess={handleSongUploaded} variant="plain" showHeader={false} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {displayedSongs.map((song) => (
          <div
            key={song.id}
            onClick={() => onSelectSong(song.id)}
            className={cn(
              "cursor-pointer group relative flex flex-col gap-2 rounded-xl border-2 p-3 transition-all hover:shadow-md",
              selectedSongId === song.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-muted bg-card hover:border-primary/50"
            )}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
              {song.coverImage ? (
                <img
                  src={song.coverImage}
                  alt={song.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary">
                  <Music2 className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
              {selectedSongId === song.id && (
                <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold leading-none truncate" title={song.title}>{song.title}</h4>
              <p className="text-xs text-muted-foreground truncate">{song.authorName || "Unknown Artist"}</p>
            </div>
          </div>
        ))}
      </div>

      {songs.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm font-medium">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  currentPage === page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {page}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {songs.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Henüz hiç şarkınız yok. Başlamak için yeni bir şarkı ekleyin.
        </div>
      )}
    </div>
  );
}
