"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

interface CampaignApprovalSectionProps {
  campaignId: string;
  totalBudget: number;
  commissionPercent: number;
  status: string;
  desiredStartDate?: string | null;
}

export function CampaignApprovalSection({
  campaignId,
  totalBudget,
  commissionPercent,
  status,
  desiredStartDate,
}: CampaignApprovalSectionProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const commission = (totalBudget * commissionPercent) / 100;
  const creatorPool = totalBudget - commission;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Onaylama başarısız");
      }

      toast.success("Kampanya onaylandı! Süre şimdi başladı.");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Kampanya onaylanamadı");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Lütfen ret sebebi girin");
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rejectionReason.trim(),
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kampanya İşlemleri</CardTitle>
          <CardDescription>
            {status === "PENDING_APPROVAL"
              ? "Kampanyayı inceleyin ve onaylayın veya reddedin. Onay sonrası süre başlar."
              : "Kampanya durumunu görüntüleyin"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Budget Breakdown (read-only, auto-calculated from tier) */}
          <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Toplam Bütçe:</span>
              <span className="font-medium">{formatCurrency(totalBudget)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Platform Komisyonu (%{commissionPercent}):</span>
              <span>-{formatCurrency(commission)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>İçerik Üreticisi Havuzu:</span>
              <span className="text-primary">{formatCurrency(creatorPool)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Max Kişi Başı (%40):</span>
              <span>{formatCurrency(creatorPool * 0.4)}</span>
            </div>
          </div>

          {/* Desired Start Date */}
          {desiredStartDate && status === "PENDING_APPROVAL" && (
            <div className="rounded-lg border p-3 bg-blue-500/10 border-blue-500/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sanatçının İstediği Başlangıç:</span>
                <span className="font-medium">{new Date(desiredStartDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            </div>
          )}

          <div className="pt-4">
            {status === "PENDING_APPROVAL" ? (
              <div className="space-y-4">
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
                    onClick={() => showRejectInput ? handleReject() : setShowRejectInput(true)}
                    disabled={isApproving || isRejecting}
                    variant="destructive"
                    className="flex-1"
                    size="lg"
                  >
                    <XCircle className="mr-2 h-5 w-5" />
                    {isRejecting ? "Reddediliyor..." : showRejectInput ? "Reddi Onayla" : "Kampanyayı Reddet"}
                  </Button>
                </div>

                {showRejectInput && (
                  <div className="space-y-2">
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ret sebebini yazın (zorunlu)..."
                      className="w-full rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <Button
                      onClick={() => { setShowRejectInput(false); setRejectionReason(""); }}
                      variant="ghost"
                      size="sm"
                    >
                      Vazgeç
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
