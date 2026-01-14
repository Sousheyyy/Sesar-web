"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface FinishCampaignButtonProps {
  campaignId: string;
  campaignStatus: string;
}

export function FinishCampaignButton({
  campaignId,
  campaignStatus,
}: FinishCampaignButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Only show button for active campaigns
  if (campaignStatus !== "ACTIVE") {
    return null;
  }

  const handleFinishCampaign = async () => {
    if (
      !confirm(
        "Kampanyayı bitirmek istediğinizden emin misiniz? Bu işlem:\n\n" +
        "1. Tüm videoların son metriklerini çekecek\n" +
        "2. Herkesin katılım oranını hesaplayacak\n" +
        "3. Kazançları dağıtacak\n\n" +
        "Bu işlem geri alınamaz!"
      )
    ) {
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Kampanya bitiriliyor...");

    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/finish`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Kampanya bitirilemedi");
      }

      toast.success("Kampanya başarıyla tamamlandı!", {
        id: toastId,
        description: `${data.metricsRefresh.updated} video metrikleri güncellendi. ${data.payout.payouts.length} kullanıcıya ödeme yapıldı.`,
      });

      // Refresh the page to show updated status
      router.refresh();
    } catch (error: any) {
      toast.error("Hata oluştu", {
        id: toastId,
        description: error.message || "Kampanya bitirilemedi",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFinishCampaign}
      disabled={isLoading}
      className="gap-2"
      variant="default"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          İşleniyor...
        </>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Kampanyayı Bitir
        </>
      )}
    </Button>
  );
}






