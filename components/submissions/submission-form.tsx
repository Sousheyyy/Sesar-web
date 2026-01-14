"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Video, 
  Link2, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ExternalLink
} from "lucide-react";

interface SubmissionFormProps {
  campaignId: string;
  tiktokHandle?: string | null;
}

export function SubmissionForm({ campaignId, tiktokHandle }: SubmissionFormProps) {
  const router = useRouter();
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);

  const validateUrl = (url: string) => {
    if (!url) {
      setIsValidUrl(null);
      return;
    }
    const isValid = url.includes("tiktok.com");
    setIsValidUrl(isValid);
    return isValid;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setTiktokUrl(url);
    validateUrl(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tiktokHandle) {
      toast.error("Video göndermeden önce TikTok profilini bağlamanız gerekir. Lütfen profil ayarlarınıza giderek hesabınızı bağlayın.");
      return;
    }

    if (!tiktokUrl) {
      toast.error("Lütfen bir TikTok video URL'si girin");
      return;
    }

    if (!validateUrl(tiktokUrl)) {
      toast.error("Lütfen geçerli bir TikTok URL'si girin");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          tiktokUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Video gönderilemedi");
      }

      // Check if this was a resubmission by checking the response
      const isResubmission = data.status === "PENDING" && data.rejectionReason === null;
      toast.success(
        isResubmission 
          ? "Video başarıyla yeniden gönderildi! Kısa süre içinde inceleyeceğiz."
          : "Video başarıyla gönderildi! Kısa süre içinde inceleyeceğiz."
      );
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Video gönderilemedi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step-by-step Guide */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Nasıl Katılır?</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col items-center text-center p-4 rounded-lg border bg-muted/30">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div className="text-sm font-semibold mb-1">1. Video Oluştur</div>
            <p className="text-xs text-muted-foreground">
              Bu şarkıyı kullanarak bir TikTok videosu oluşturun
            </p>
          </div>
          <div className="flex flex-col items-center text-center p-4 rounded-lg border bg-muted/30">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Link2 className="h-6 w-6 text-primary" />
            </div>
            <div className="text-sm font-semibold mb-1">2. Linki Kopyala</div>
            <p className="text-xs text-muted-foreground">
              TikTok'ta videonuzun linkini kopyalayın
            </p>
          </div>
          <div className="flex flex-col items-center text-center p-4 rounded-lg border bg-muted/30">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Send className="h-6 w-6 text-primary" />
            </div>
            <div className="text-sm font-semibold mb-1">3. Gönder</div>
            <p className="text-xs text-muted-foreground">
              Linki aşağıya yapıştırın ve gönderin
            </p>
          </div>
        </div>
      </div>

      {/* TikTok Handle Info */}
      {tiktokHandle && (
        <div className="rounded-lg border bg-muted/30 p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">TikTok Profiliniz</p>
            <p className="text-xs text-muted-foreground">
              Gönderim hesabı: <span className="font-medium">@{tiktokHandle}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Gönderdiğiniz video URL'sinin bu hesaba ait olduğundan emin olun
            </p>
          </div>
          <a
            href={`https://www.tiktok.com/@${tiktokHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm flex items-center gap-1"
          >
            Profili Görüntüle
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {!tiktokHandle && (
        <div className="rounded-lg border-2 border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              TikTok Profile Required
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              You must connect your TikTok profile in your{" "}
              <a href="/profile" className="underline font-medium hover:text-red-900 dark:hover:text-red-100">
                profile settings
              </a>{" "}
              before you can submit videos to campaigns.
            </p>
          </div>
        </div>
      )}

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tiktokUrl" className="text-base font-semibold">
            TikTok Video URL'si
          </Label>
          <div className="relative">
            <Input
              id="tiktokUrl"
              type="url"
              placeholder="https://www.tiktok.com/@kullaniciadi/video/..."
              value={tiktokUrl}
              onChange={handleUrlChange}
              required
              disabled={isSubmitting || !tiktokHandle}
              className={`pr-10 text-base h-12 ${
                isValidUrl === true
                  ? "border-green-500 focus:ring-green-500"
                  : isValidUrl === false
                  ? "border-red-500 focus:ring-red-500"
                  : ""
              } ${!tiktokHandle ? "opacity-50 cursor-not-allowed" : ""}`}
            />
            {isValidUrl === true && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
            )}
            {isValidUrl === false && tiktokUrl && (
              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
            )}
          </div>
          {isValidUrl === false && tiktokUrl && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Geçerli bir TikTok URL'si girin
            </p>
          )}
          {isValidUrl === true && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              URL geçerli görünüyor
            </p>
          )}
          {isValidUrl === null && (
            <p className="text-xs text-muted-foreground">
              Bu şarkıyı kullanan TikTok videonuzun linkini yapıştırın
            </p>
          )}
        </div>

        {/* Requirements Checklist */}
        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Göndermeden önce kontrol edin:
          </h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Videonuzun bu kampanyadaki tam şarkıyı kullandığından emin olun
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Videonuz minimum süre gereksinimini karşılıyor olmalı
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Videonuz TikTok'ta herkese açık olmalı
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Takipçi gereksinimlerini karşılıyor olmalısınız
              </span>
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={isSubmitting || !tiktokUrl || isValidUrl === false || !tiktokHandle} 
          className="w-full h-12 text-base font-semibold gap-2"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Gönderiliyor...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Video Gönder ve Kazanmaya Başla
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Gönderiniz incelendikten sonra onaylanacak ve performans metrikleriniz takip edilecektir
        </p>
      </form>
    </div>
  );
}


