"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmActionModal } from "@/components/admin/confirm-action-modal";

interface FinishCampaignButtonProps {
  campaignId: string;
  campaignStatus: string;
}

export function FinishCampaignButton({
  campaignId,
  campaignStatus,
}: FinishCampaignButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  // Only show button for active campaigns
  if (campaignStatus !== "ACTIVE") {
    return null;
  }

  const handleFinishCampaign = async () => {
    setShowConfirm(false);
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
        description: `Ödeme işlemi tamamlandı.`,
      });

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
    <>
      <Button
        onClick={() => setShowConfirm(true)}
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
      <ConfirmActionModal
        isOpen={showConfirm}
        onConfirm={handleFinishCampaign}
        onCancel={() => setShowConfirm(false)}
        title="Kampanyayı Bitir"
        description="Bu işlem kazançları dağıtacak ve geri alınamaz. Devam etmek için şifrenizi girin."
      />
    </>
  );
}






