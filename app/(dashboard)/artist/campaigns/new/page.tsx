"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

import { StepMusicSelection } from "@/components/campaigns/create/step-music-selection";
import { StepCampaignDetails } from "@/components/campaigns/create/step-campaign-details";
import { StepCampaignDuration } from "@/components/campaigns/create/step-campaign-duration";
import { StepBudget } from "@/components/campaigns/create/step-budget";
import { CampaignSummarySidebar } from "@/components/campaigns/create/campaign-summary-sidebar";
import { getBracket, getEstimates } from "@/components/campaigns/create/campaign-utils";
import { MIN_BUDGET, MAX_BUDGET, MIN_DURATION, MAX_DURATION } from "@/components/campaigns/create/campaign-constants";
import type { Song, CampaignFormData } from "@/components/campaigns/create/types";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export default function NewCampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <NewCampaignPageContent />
    </Suspense>
  );
}

function NewCampaignPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedSongId = searchParams?.get("songId") ?? null;

  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const [formData, setFormData] = useState<CampaignFormData>({
    songId: preSelectedSongId || "",
    title: "",
    description: "",
    totalBudget: "",
    startDate: null,
    endDate: null,
    minVideoDuration: "15",
  });

  useEffect(() => {
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

    fetch("/api/user/balance")
      .then((res) => res.json())
      .then((data) => setWalletBalance(data.balance))
      .catch((error) => {
        console.error("Failed to fetch balance:", error);
      });
  }, []);

  // Auto-fill campaign title when song is pre-selected from URL
  useEffect(() => {
    if (preSelectedSongId && songs.length > 0 && !formData.title) {
      const song = songs.find((s) => s.id === preSelectedSongId);
      if (song) {
        setFormData((prev) => ({
          ...prev,
          songId: preSelectedSongId,
          title: `${song.title} Kampanyası`,
        }));
      }
    }
  }, [preSelectedSongId, songs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived values
  const budget = parseFloat(formData.totalBudget) || 0;
  const durationDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const diffMs = formData.endDate.getTime() - formData.startDate.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }, [formData.startDate, formData.endDate]);

  const bracket = useMemo(() => getBracket(budget), [budget]);
  const estimates = useMemo(
    () => (bracket && durationDays > 0 ? getEstimates(budget, durationDays) : null),
    [bracket, budget, durationDays]
  );
  const selectedSong = songs.find((s) => s.id === formData.songId) ?? null;

  const canSubmit =
    !!formData.songId &&
    !!formData.title &&
    budget >= MIN_BUDGET &&
    budget <= MAX_BUDGET &&
    !!bracket &&
    durationDays >= MIN_DURATION &&
    durationDays <= MAX_DURATION &&
    walletBalance >= budget;

  // Handlers
  const handleSongUploaded = (song: Song) => {
    setSongs([song, ...songs]);
    setFormData((prev) => ({ ...prev, songId: song.id }));
    toast.success("Şarkı başarıyla eklendi!");
  };

  const handleDateClick = (date: Date) => {
    const minStart = new Date();
    minStart.setDate(minStart.getDate() + 3);
    minStart.setHours(0, 0, 0, 0);

    if (date < minStart) return;

    if (!formData.startDate || formData.endDate) {
      // First click or resetting range
      setFormData((prev) => ({ ...prev, startDate: date, endDate: null }));
    } else {
      // Second click - setting end date
      if (date <= formData.startDate) {
        setFormData((prev) => ({ ...prev, startDate: date, endDate: null }));
        return;
      }
      const diffDays = Math.round((date.getTime() - formData.startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < MIN_DURATION) {
        toast.error(`Minimum kampanya süresi ${MIN_DURATION} gün`);
        return;
      }
      if (diffDays > MAX_DURATION) {
        toast.error(`Maksimum kampanya süresi ${MAX_DURATION} gün`);
        return;
      }
      setFormData((prev) => ({ ...prev, endDate: date }));
    }
  };

  const handleQuickSelect = (days: number) => {
    const start = formData.startDate ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    setFormData((prev) => ({ ...prev, startDate: start, endDate: end }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: formData.songId,
          title: formData.title,
          description: formData.description || null,
          totalBudget: budget,
          durationDays,
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
        {/* Left Column - 4 Steps */}
        <div className="lg:col-span-2 space-y-8">
          <StepMusicSelection
            songs={songs}
            selectedSongId={formData.songId}
            onSelectSong={(id) => setFormData((prev) => ({ ...prev, songId: id }))}
            onSongUploaded={handleSongUploaded}
          />

          <Separator />

          <StepCampaignDetails
            title={formData.title}
            description={formData.description}
            minVideoDuration={formData.minVideoDuration}
            onTitleChange={(val) => setFormData((prev) => ({ ...prev, title: val }))}
            onDescriptionChange={(val) => setFormData((prev) => ({ ...prev, description: val }))}
            onMinVideoDurationChange={(val) => setFormData((prev) => ({ ...prev, minVideoDuration: val }))}
          />

          <Separator />

          <StepCampaignDuration
            startDate={formData.startDate}
            endDate={formData.endDate}
            durationDays={durationDays}
            onDateClick={handleDateClick}
            onQuickSelect={handleQuickSelect}
          />

          <Separator />

          <StepBudget
            totalBudget={formData.totalBudget}
            onBudgetChange={(val) => setFormData((prev) => ({ ...prev, totalBudget: val }))}
            walletBalance={walletBalance}
          />
        </div>

        {/* Right Column - Sticky Summary */}
        <div>
          <CampaignSummarySidebar
            selectedSong={selectedSong}
            title={formData.title}
            durationDays={durationDays}
            startDate={formData.startDate}
            endDate={formData.endDate}
            totalBudget={budget}
            estimates={estimates}
            isLoading={isLoading}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
