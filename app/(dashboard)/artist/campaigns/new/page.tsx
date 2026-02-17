"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongUpload } from "@/components/upload/song-upload";
import { Music2, CheckCircle2, Sparkles, ChevronLeft, ChevronRight, Clock, TrendingUp, Users, Eye, Heart, Share2, CalendarDays } from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import { cn, formatCurrency } from "@/lib/utils";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Budget bracket system (mirrors server-side tierUtils)
const MIN_BUDGET = 20000;
const MAX_BUDGET = 1000000;
const MIN_DURATION = 5;
const MAX_DURATION = 30;

const BUDGET_BRACKETS = [
  { min: 100000, max: 1000000, commission: 10, reachMin: 20, reachMax: 35, likeMin: 0.06, likeMax: 0.09, shareMin: 0.015, shareMax: 0.022 },
  { min: 70000,  max: 99999,   commission: 12, reachMin: 15, reachMax: 28, likeMin: 0.05, likeMax: 0.08, shareMin: 0.012, shareMax: 0.018 },
  { min: 40000,  max: 69999,   commission: 15, reachMin: 12, reachMax: 22, likeMin: 0.05, likeMax: 0.07, shareMin: 0.01,  shareMax: 0.015 },
  { min: 20000,  max: 39999,   commission: 20, reachMin: 8,  reachMax: 15, likeMin: 0.04, likeMax: 0.06, shareMin: 0.008, shareMax: 0.012 },
];

function getBracket(budget: number) {
  if (budget < MIN_BUDGET) return null;
  for (const b of BUDGET_BRACKETS) {
    if (budget >= b.min) return b;
  }
  return null;
}

function getEstimates(budget: number, durationDays: number) {
  const bracket = getBracket(budget);
  if (!bracket) return null;
  const df = durationDays / 15;
  const minViews = Math.round(budget * bracket.reachMin * df);
  const maxViews = Math.round(budget * bracket.reachMax * df);
  return {
    commission: bracket.commission,
    minViews, maxViews,
    minLikes: Math.round(minViews * bracket.likeMin), maxLikes: Math.round(maxViews * bracket.likeMax),
    minShares: Math.round(minViews * bracket.shareMin), maxShares: Math.round(maxViews * bracket.shareMax),
  };
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const TURKISH_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TURKISH_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

interface Song {
  id: string;
  title: string;
  duration: number;
  authorName: string | null;
  coverImage: string | null;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSongDialogOpen, setIsSongDialogOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const [walletBalance, setWalletBalance] = useState(0);

  const [formData, setFormData] = useState({
    songId: "",
    title: "",
    description: "",
    totalBudget: "",
    durationDays: 15,
    minVideoDuration: "15",
  });

  useEffect(() => {
    // Fetch songs
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        if (data.data && Array.isArray(data.data)) {
          setSongs(data.data);
        } else if (Array.isArray(data)) {
          setSongs(data);
        } else {
          console.error("Unexpected songs response format:", data);
          setSongs([]);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch songs:", error);
        toast.error("Şarkılar yüklenemedi");
        setSongs([]);
      });

    // Fetch wallet balance
    fetch("/api/user/balance")
      .then((res) => res.json())
      .then((data) => setWalletBalance(data.balance))
      .catch((error) => {
        console.error("Failed to fetch balance:", error);
      });
  }, []);

  const handleSongUploaded = (song: Song) => {
    setSongs([song, ...songs]);
    setFormData({ ...formData, songId: song.id });
    setIsSongDialogOpen(false);
    toast.success("Şarkı başarıyla eklendi!");
  };

  // Budget and duration calculations
  const budget = parseFloat(formData.totalBudget) || 0;
  const bracket = useMemo(() => getBracket(budget), [budget]);
  const estimates = useMemo(() => bracket ? getEstimates(budget, formData.durationDays) : null, [bracket, budget, formData.durationDays]);

  // Calendar state
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + formData.durationDays);
    return d;
  }, [startDate, formData.durationDays]);

  const [calendarMonth, setCalendarMonth] = useState(() => ({
    year: startDate.getFullYear(),
    month: startDate.getMonth(),
  }));

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [calendarMonth]);

  const isInRange = (date: Date) => {
    const s = new Date(startDate); s.setHours(0,0,0,0);
    const e = new Date(endDate); e.setHours(0,0,0,0);
    const d = new Date(date); d.setHours(0,0,0,0);
    return d >= s && d <= e;
  };

  const isStart = (date: Date) => date.toDateString() === startDate.toDateString();
  const isEnd = (date: Date) => date.toDateString() === endDate.toDateString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.songId) {
      toast.error("Lütfen bir şarkı seçin");
      return;
    }

    const totalBudget = parseFloat(formData.totalBudget);

    if (!formData.totalBudget || isNaN(totalBudget)) {
      toast.error("Geçerli bir bütçe giriniz");
      return;
    }

    if (totalBudget < MIN_BUDGET) {
      toast.error("Minimum kampanya bütçesi ₺20,000");
      return;
    }

    if (totalBudget > MAX_BUDGET) {
      toast.error("Maksimum kampanya bütçesi ₺1,000,000");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: formData.songId,
          title: formData.title,
          description: formData.description || null,
          totalBudget,
          durationDays: formData.durationDays,
          minVideoDuration: formData.minVideoDuration ? parseInt(formData.minVideoDuration) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Kampanya oluşturulamadı");
      }

      toast.success("Kampanya oluşturuldu! Yönetici onayı bekleniyor.");
      router.push(`/artist/campaigns/${data.id}`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Kampanya oluşturulamadı");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSong = songs.find(s => s.id === formData.songId);

  // Pagination logic
  const totalPages = Math.ceil(songs.length / ITEMS_PER_PAGE);
  const displayedSongs = songs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          Yeni Kampanya
        </h2>
        <p className="text-muted-foreground text-lg">
          Şarkınız için viral bir kampanya başlatın ve içerik üreticilerine ulaşın.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Content */}
        <div className="lg:col-span-2 space-y-8">

          {/* Step 1: Music Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">1</span>
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
                  onClick={() => setFormData({ ...formData, songId: song.id })}
                  className={cn(
                    "cursor-pointer group relative flex flex-col gap-2 rounded-xl border-2 p-3 transition-all hover:shadow-md",
                    formData.songId === song.id
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
                    {formData.songId === song.id && (
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

          <Separator />

          {/* Step 2: Campaign Details */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">2</span>
              Kampanya Detayları
            </h3>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Kampanya Başlığı</Label>
                  <Input
                    id="title"
                    placeholder="Örn: Yaz Hit Promosyonu"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="h-12 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Açıklama & Vizyon</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="İçerik üreticilerinden ne bekliyorsunuz? (Örn: Dans videosu, dudak senkronizasyonu...)"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minVideoDuration">Min. Video Süresi (sn)</Label>
                  <Input
                    id="minVideoDuration"
                    type="number"
                    min="5"
                    max="180"
                    placeholder="15"
                    value={formData.minVideoDuration}
                    onChange={(e) => setFormData({ ...formData, minVideoDuration: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Right Column - Sticky Sidebar with Budget & Duration */}
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-lg sticky top-6">
            <CardContent className="space-y-6 pt-6">

              <div className="space-y-3">
                <Label className="text-base font-semibold">Toplam Bütçe</Label>
                <div className="relative">
                  <TLIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="number"
                    min="20000"
                    max="1000000"
                    placeholder="20000"
                    className="pl-12 h-14 text-2xl font-bold"
                    value={formData.totalBudget}
                    onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Min: ₺20,000</span>
                  <span>Max: ₺1,000,000</span>
                </div>

                {/* Duration Slider */}
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      Kampanya Süresi
                    </Label>
                    <Badge variant="outline" className="text-primary border-primary font-bold">
                      {formData.durationDays} gün
                    </Badge>
                  </div>
                  <input
                    type="range"
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>{MIN_DURATION} gün</span>
                    <span>{MAX_DURATION} gün</span>
                  </div>

                  {/* Quick select buttons */}
                  <div className="flex gap-1.5">
                    {[5, 7, 14, 21, 30].map(d => (
                      <button
                        key={d}
                        onClick={() => setFormData({ ...formData, durationDays: d })}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors border",
                          formData.durationDays === d
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-muted hover:border-primary/50"
                        )}
                      >
                        {d}g
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mini Calendar */}
                <div className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setCalendarMonth(prev =>
                        prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 }
                      )}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-semibold">
                      {TURKISH_MONTHS[calendarMonth.month]} {calendarMonth.year}
                    </span>
                    <button
                      onClick={() => setCalendarMonth(prev =>
                        prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 }
                      )}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {TURKISH_DAYS_SHORT.map(d => (
                      <div key={d} className="text-center text-[9px] text-muted-foreground font-medium">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((date, idx) => {
                      if (!date) return <div key={`e-${idx}`} className="h-6" />;
                      const inRange = isInRange(date);
                      const start = isStart(date);
                      const end = isEnd(date);
                      return (
                        <div key={idx} className="flex items-center justify-center h-6">
                          <div className={cn(
                            "w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium",
                            start ? "bg-primary text-primary-foreground" :
                            end ? "bg-violet-500 text-white" :
                            inRange ? "bg-primary/15 text-primary" :
                            "text-muted-foreground"
                          )}>
                            {date.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t text-[10px]">
                    <span className="text-primary font-semibold">
                      Başlangıç: {startDate.getDate()} {TURKISH_MONTHS[startDate.getMonth()].slice(0,3)}
                    </span>
                    <span className="text-violet-500 font-semibold">
                      Bitiş: {endDate.getDate()} {TURKISH_MONTHS[endDate.getMonth()].slice(0,3)}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                {bracket && estimates && (
                  <div className="space-y-4 pt-2">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground font-medium">Süre</span>
                        </div>
                        <p className="text-sm font-bold">{formData.durationDays} gün</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground font-medium">Komisyon</span>
                        </div>
                        <p className="text-sm font-bold">%{estimates.commission}</p>
                      </div>
                    </div>

                    {/* Net Budget */}
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Net Bütçe (Üreticilere)</span>
                        <span className="text-sm font-bold text-green-500">
                          {formatCurrency(budget * (100 - estimates.commission) / 100)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Estimated Results */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tahmini Sonuçlar</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs text-muted-foreground">Erişim</span>
                          </div>
                          <span className="text-xs font-semibold">{formatNum(estimates.minViews)} - {formatNum(estimates.maxViews)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-1.5">
                            <Heart className="h-3.5 w-3.5 text-pink-400" />
                            <span className="text-xs text-muted-foreground">Beğeni</span>
                          </div>
                          <span className="text-xs font-semibold">{formatNum(estimates.minLikes)} - {formatNum(estimates.maxLikes)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-1.5">
                            <Share2 className="h-3.5 w-3.5 text-purple-400" />
                            <span className="text-xs text-muted-foreground">Paylaşım</span>
                          </div>
                          <span className="text-xs font-semibold">{formatNum(estimates.minShares)} - {formatNum(estimates.maxShares)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Unlimited Participation */}
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-500">Sınırsız Katılım</span>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mevcut Bakiye:</span>
                    <span className="font-medium">{formatCurrency(walletBalance)}</span>
                  </div>
                  {formData.totalBudget && !isNaN(parseFloat(formData.totalBudget)) && (
                    <div className={cn("flex justify-between text-sm mt-1",
                      (walletBalance - parseFloat(formData.totalBudget)) < 0 ? "text-red-500" : "text-green-600"
                    )}>
                      <span>Kalan Bakiye:</span>
                      <span className="font-bold">{formatCurrency(walletBalance - parseFloat(formData.totalBudget))}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Şarkı</span>
                  <span className="font-medium truncate max-w-[150px]">{selectedSong?.title || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Süre</span>
                  <span className="font-medium">{formData.durationDays} Gün</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Komisyon</span>
                  <span className="font-medium">{estimates ? `%${estimates.commission}` : "-"}</span>
                </div>
                <div className="flex justify-between items-center pt-2 text-lg font-bold">
                  <span>Toplam</span>
                  <span className="text-primary">
                    {formData.totalBudget ? formatCurrency(parseFloat(formData.totalBudget)) : formatCurrency(0)}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isLoading || !formData.songId || !formData.totalBudget || !bracket}
                className="w-full h-12 text-lg font-semibold shadow-md transition-all hover:shadow-lg hover:scale-[1.02]"
              >
                {isLoading ? "Oluşturuluyor..." : "Kampanyayı Başlat"}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                Kampanya, yönetici onayından sonra aktif olacaktır. Süre onay tarihinden itibaren başlar.
              </p>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
