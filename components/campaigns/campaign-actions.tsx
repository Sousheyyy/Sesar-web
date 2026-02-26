"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CampaignActionsProps {
  campaignId: string;
  currentStatus: string;
}

export function CampaignActions({ campaignId, currentStatus }: CampaignActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const handleDelete = async () => {
    if (!confirm("Bu kampanyayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Kampanya silinemedi");
      }

      toast.success("Kampanya başarıyla silindi");
      router.push("/artist/campaigns");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Kampanya silinirken bir hata oluştu");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="destructive"
        size="sm"
        className="gap-2"
        onClick={handleDelete}
        disabled={isLoading}
      >
        <Trash2 className="h-4 w-4" />
        Sil
      </Button>
    </div>
  );
}







