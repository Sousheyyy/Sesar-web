"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongUpload } from "@/components/upload/song-upload";
import { Users, PlayCircle, BarChart, Music2, Calendar as CalendarIcon, Plus, CheckCircle2, Info, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import { DatePicker } from "@/components/ui/new-date-picker";
import { cn, formatCurrency } from "@/lib/utils";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const [walletBalance, setWalletBalance] = useState(0);

  const [formData, setFormData] = useState({
    songId: "",
    title: "",
    description: "",
    totalBudget: "",
    minFollowers: "",
    minVideoDuration: "15",
    startDate: "",
    endDate: "",
    targetTiers: [] as string[],
    isProOnly: false,
  });

  const availableTiers = ["C", "B", "A", "S"];

  useEffect(() => {
    // Fetch songs
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        // Handle paginated response structure
        if (data.data && Array.isArray(data.data)) {
          setSongs(data.data);
        } else if (Array.isArray(data)) {
          // Fallback: if API returns array directly
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

  const handleTierToggle = (tier: string) => {
    setFormData(prev => {
      const currentTiers = prev.targetTiers;
      if (currentTiers.includes(tier)) {
        return { ...prev, targetTiers: currentTiers.filter(t => t !== tier) };
      } else {
        return { ...prev, targetTiers: [...currentTiers, tier] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.songId) {
      toast.error("Lütfen bir şarkı seçin");
      return;
    }

    if (!formData.startDate) {
      toast.error("Lütfen kampanya başlangıç tarihi seçin");
      return;
    }

    if (!formData.endDate) {
      toast.error("Lütfen kampanya bitiş tarihi seçin");
      return;
    }

    const totalBudget = parseFloat(formData.totalBudget);

    if (!formData.totalBudget || isNaN(totalBudget)) {
      toast.error("Geçerli bir bütçe giriniz");
      return;
    }

    if (totalBudget < 20000) {
      toast.error("Minimum kampanya bütçesi ₺20,000");
      return;
    }

    // Validate dates
    const campaignStartDate = new Date(formData.startDate);
    const campaignEndDate = new Date(formData.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset to start of today for comparison

    if (campaignStartDate < now) {
      toast.error("Başlangıç tarihi bugün veya gelecekte olmalıdır");
      return;
    }

    if (campaignEndDate <= campaignStartDate) {
      toast.error("Bitiş tarihi başlangıç tarihinden sonra olmalıdır");
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
          minFollowers: formData.minFollowers ? parseInt(formData.minFollowers) : null,
          minVideoDuration: formData.minVideoDuration ? parseInt(formData.minVideoDuration) : null,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
          targetTiers: formData.targetTiers,
          isProOnly: formData.isProOnly,
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
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Step 3: Targeting & Schedule */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">3</span>
              Hedefleme & Zamanlama
            </h3>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Hedef Kitle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-2 border p-3 rounded-lg bg-secondary/20">
                    <input
                      type="checkbox"
                      id="isProOnly"
                      className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={formData.isProOnly}
                      onChange={(e) => setFormData({ ...formData, isProOnly: e.target.checked })}
                    />
                    <Label htmlFor="isProOnly" className="font-medium cursor-pointer">
                      Sadece PRO Üyeler Katılabilsin
                      <span className="block text-xs text-muted-foreground font-normal">
                        Daha deneyimli içerik üreticilerine ulaşın
                      </span>
                    </Label>
                  </div>

                  <div className="space-y-3">
                    <Label className="block">Hedef İçerik Üretici Seviyeleri</Label>
                    <div className="flex gap-2 flex-wrap">
                      {availableTiers.map((tier) => (
                        <div
                          key={tier}
                          onClick={() => handleTierToggle(tier)}
                          className={cn(
                            "cursor-pointer px-3 py-1.5 rounded-md border text-sm font-medium transition-colors flex items-center justify-center min-w-[36px]",
                            formData.targetTiers.includes(tier)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-input"
                          )}
                        >
                          {tier}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formData.targetTiers.length === 0
                        ? "Seçim yapılmazsa TÜM seviyeler katılabilir."
                        : "Sadece seçilen seviyelerdeki üreticiler katılabilir."}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="minFollowers">Minimum Takipçi</Label>
                    <Input
                      id="minFollowers"
                      type="number"
                      min="0"
                      placeholder="1000"
                      value={formData.minFollowers}
                      onChange={(e) => setFormData({ ...formData, minFollowers: e.target.value })}
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    Zamanlama
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Başlangıç Tarihi</Label>
                    <DatePicker
                      date={startDate}
                      setDate={(date) => {
                        setStartDate(date);
                        setFormData(prev => ({
                          ...prev,
                          startDate: date ? date.toISOString() : ""
                        }));
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      placeholder="Seçiniz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitiş Tarihi</Label>
                    <DatePicker
                      date={endDate}
                      setDate={(date) => {
                        setEndDate(date);
                        setFormData(prev => ({
                          ...prev,
                          endDate: date ? date.toISOString() : ""
                        }));
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (date < today) return true;
                        if (startDate && date <= startDate) return true;
                        return false;
                      }}
                      placeholder="Seçiniz"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>

        {/* Right Column - Sticky Sidebar */}
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
                    placeholder="20000"
                    className="pl-12 h-14 text-2xl font-bold"
                    value={formData.totalBudget}
                    onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Min: ₺20,000.00</span>
                  <span className="text-primary">Platform ücreti dahildir</span>
                </div>

                {/* Automatic Participant Limit Info */}
                {formData.totalBudget && !isNaN(parseFloat(formData.totalBudget)) && parseFloat(formData.totalBudget) >= 20000 && (
                  <div className="bg-primary/10 p-3 rounded-lg border border-primary/20 mt-2">
                    <div className="text-sm font-medium flex justify-between">
                      <span>Maksimum Katılımcı:</span>
                      <span className="font-bold">{Math.floor(parseFloat(formData.totalBudget) / 100)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Her 1000 TL bütçe için 10 katılımcı hakkı tanımlanır.
                    </p>
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
                  <span className="font-medium">
                    {startDate && endDate
                      ? `${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} Gün`
                      : "-"}
                  </span>
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
                disabled={isLoading || !formData.songId || !formData.totalBudget}
                className="w-full h-12 text-lg font-semibold shadow-md transition-all hover:shadow-lg hover:scale-[1.02]"
              >
                {isLoading ? "Oluşturuluyor..." : "Kampanyayı Başlat"}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                "Kampanyayı Başlat" butonuna tıklayarak Hizmet Koşullarımızı kabul etmiş olursunuz.
              </p>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
