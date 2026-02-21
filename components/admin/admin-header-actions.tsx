"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionModal } from "@/components/admin/confirm-action-modal";

interface AdminCampaignHeaderActionsProps {
  campaignId: string;
  currentStatus: string;
}

export function AdminCampaignHeaderActions({ campaignId, currentStatus }: AdminCampaignHeaderActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePause = async () => {
    if (!confirm("Bu kampanyayı duraklatmak istediğinizden emin misiniz?")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "PAUSED" }),
      });

      if (!response.ok) {
        throw new Error("Kampanya duraklatılamadı");
      }

      setStatus("PAUSED");
      toast.success("Kampanya başarıyla duraklatıldı");
      router.refresh();
    } catch (error) {
      console.error("Pause error:", error);
      toast.error("Kampanya duraklatılırken bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "ACTIVE" }),
      });

      if (!response.ok) {
        throw new Error("Kampanya başlatılamadı");
      }

      setStatus("ACTIVE");
      toast.success("Kampanya başarıyla başlatıldı");
      router.refresh();
    } catch (error) {
      console.error("Start error:", error);
      toast.error("Kampanya başlatılırken bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Kampanya silinemedi");
      }

      toast.success("Kampanya başarıyla silindi");
      router.push("/admin/campaigns");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Kampanya silinirken bir hata oluştu");
      setIsLoading(false);
    }
  };

  // Don't show these actions if pending approval, as the main body has the approval/reject buttons
  if (status === "PENDING_APPROVAL") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {status === "ACTIVE" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handlePause}
          disabled={isLoading}
        >
          <Pause className="h-4 w-4" />
          Duraklat
        </Button>
      )}

      {status === "PAUSED" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleStart}
          disabled={isLoading}
        >
          <Play className="h-4 w-4" />
          Başlat
        </Button>
      )}

      <Button
        variant="destructive"
        size="sm"
        className="gap-2"
        onClick={() => setShowDeleteConfirm(true)}
        disabled={isLoading}
      >
        <Trash2 className="h-4 w-4" />
        Sil
      </Button>
      <ConfirmActionModal
        isOpen={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Kampanyayı Sil"
        description="Bu işlem geri alınamaz. Devam etmek için şifrenizi girin."
      />
    </div>
  );
}

