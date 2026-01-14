"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle, XCircle, Play, Pause, Trash2 } from "lucide-react";

interface CampaignApprovalSectionProps {
  campaignId: string;
  totalBudget: number;
  initialPlatformFeePercent: number;
  initialSafetyReservePercent: number;
  status: string;
}

export function CampaignApprovalSection({
  campaignId,
  totalBudget,
  initialPlatformFeePercent,
  initialSafetyReservePercent,
  status,
}: CampaignApprovalSectionProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(initialPlatformFeePercent);
  const [safetyReservePercent, setSafetyReservePercent] = useState(initialSafetyReservePercent);

  const platformFee = (totalBudget * platformFeePercent) / 100;
  const safetyReserve = (totalBudget * safetyReservePercent) / 100;
  const creatorPool = (totalBudget * (100 - platformFeePercent - safetyReservePercent)) / 100;

  const handleApprove = async () => {
    if (platformFeePercent + safetyReservePercent >= 100) {
      toast.error("Toplam ücretler %100'den az olmalıdır");
      return;
    }

    setIsApproving(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformFeePercent,
          safetyReservePercent,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Onaylama başarısız");
      }

      toast.success("Kampanya onaylandı!");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Kampanya onaylanamadı");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Bu kampanyayı reddetmek istediğinizden emin misiniz? Bütçe sanatçıya iade edilecektir.")) {
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Admin tarafından reddedildi", // Simple default reason since we removed the input
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Reddetme başarısız");
      }

      toast.success("Kampanya reddedildi ve bütçe iade edildi");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Kampanya reddedilemedi");
    } finally {
      setIsRejecting(false);
    }
  };

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
      router.push("/admin/campaigns");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Kampanya silinirken bir hata oluştu");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kampanya İşlemleri</CardTitle>
          <CardDescription>
            {status === "PENDING_APPROVAL" 
              ? "Kampanyayı inceleyin ve onaylayın veya reddedin"
              : "Kampanya durumunu yönetin"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration - Only editable when pending approval, readonly otherwise */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platformFee">Platform Hizmet Ücreti (%)</Label>
              <Input
                id="platformFee"
                type="number"
                min="0"
                max="100"
                value={platformFeePercent}
                onChange={(e) => setPlatformFeePercent(Number(e.target.value))}
                disabled={status !== "PENDING_APPROVAL"}
              />
              <p className="text-sm text-muted-foreground">
                Tutar: {formatCurrency(platformFee)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="safetyReserve">Güvenlik Rezervi (%)</Label>
              <Input
                id="safetyReserve"
                type="number"
                min="0"
                max="100"
                value={safetyReservePercent}
                onChange={(e) => setSafetyReservePercent(Number(e.target.value))}
                disabled={status !== "PENDING_APPROVAL"}
              />
              <p className="text-sm text-muted-foreground">
                Tutar: {formatCurrency(safetyReserve)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Toplam Bütçe:</span>
              <span className="font-medium">{formatCurrency(totalBudget)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Platform Ücreti ({platformFeePercent}%):</span>
              <span>-{formatCurrency(platformFee)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Güvenlik Rezervi ({safetyReservePercent}%):</span>
              <span>-{formatCurrency(safetyReserve)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>İçerik Üreticisi Havuzu:</span>
              <span className="text-primary">{formatCurrency(creatorPool)}</span>
            </div>
          </div>

          <div className="pt-4">
            {status === "PENDING_APPROVAL" ? (
              <div className="flex gap-4">
                <Button
                  onClick={handleApprove}
                  disabled={isApproving || isRejecting}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {isApproving ? "Onaylanıyor..." : "Kampanyayı Onayla"}
                </Button>

                <Button
                  onClick={handleReject}
                  disabled={isApproving || isRejecting}
                  variant="destructive"
                  className="flex-1"
                  size="lg"
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  {isRejecting ? "Reddediliyor..." : "Kampanyayı Reddet"}
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
