"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
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

  return (
    <div className="flex items-center gap-2">
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

