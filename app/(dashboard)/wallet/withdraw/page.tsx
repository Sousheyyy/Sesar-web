"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';
import { ArrowLeft } from "lucide-react";

export default function WithdrawPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [formData, setFormData] = useState({
    amount: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    routingNumber: "",
  });

  useEffect(() => {
    // Fetch user balance
    fetch("/api/user/balance")
      .then((res) => res.json())
      .then((data) => setBalance(data.balance))
      .catch((error) => {
        console.error("Failed to fetch balance:", error);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);

    if (amount < 500) {
      toast.error("Minimum çekim tutarı ₺500'dür");
      return;
    }

    if (amount > balance) {
      toast.error("Yetersiz bakiye");
      return;
    }

    if (!formData.bankName || !formData.accountName || !formData.accountNumber) {
      toast.error("Lütfen tüm banka bilgilerini doldurun");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/transactions/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          bankDetails: {
            bankName: formData.bankName,
            accountName: formData.accountName,
            accountNumber: formData.accountNumber,
            routingNumber: formData.routingNumber || null,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Para çekme talebi oluşturulamadı");
      }

      toast.success("Para çekme talebi gönderildi! Yönetici onayı bekleniyor.");
      router.push("/wallet");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Para çekme talebi gönderilemedi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/wallet">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Para Çek</h2>
          <p className="text-muted-foreground">
            Banka hesabınıza para çekme talebi gönderin
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Para Çekme Talebi</CardTitle>
          <CardDescription>
            Ödeme almak için tutarı ve banka bilgilerinizi girin
          </CardDescription>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">
              ⚠️ Minimum çekim tutarı: <span className="font-bold">₺500</span>
            </p>
            <p className="text-xs text-blue-700 mt-1">
              500 TL'den az tutarlar için para çekme talebi oluşturulamaz.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Kullanılabilir Bakiye:</span>
                <span className="text-lg font-bold">
                  ₺{balance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Çekim Tutarı (₺) *</Label>
              <Input
                id="amount"
                type="number"
                min="500"
                max={balance}
                step="0.01"
                placeholder="500"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                disabled={isSubmitting}
              />
              <p className="text-sm text-muted-foreground">
                Minimum çekim tutarı: <span className="font-semibold text-foreground">₺500</span>
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-semibold">Banka Hesap Detayları</h4>

              <div className="space-y-2">
                <Label htmlFor="bankName">Banka Adı *</Label>
                <Input
                  id="bankName"
                  placeholder="örn., Garanti Bankası"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">Hesap Sahibinin Adı *</Label>
                <Input
                  id="accountName"
                  placeholder="Tam adınız"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Hesap Numarası *</Label>
                <Input
                  id="accountNumber"
                  placeholder="1234567890"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="routingNumber">Yönlendirme Numarası (İsteğe Bağlı)</Label>
                <Input
                  id="routingNumber"
                  placeholder="987654321"
                  value={formData.routingNumber}
                  onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Not:</strong> Para çekme talepleri yöneticiler tarafından manuel olarak işlenir.
                Bu işlem genellikle 1-3 iş günü sürer.
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting || balance < 500} className="w-full">
              {isSubmitting ? "Gönderiliyor..." : "Para Çekme Talebi Gönder"}
            </Button>
            {balance < 500 && (
              <p className="text-sm text-destructive text-center">
                Para çekmek için minimum ₺500 bakiyeniz olmalıdır. Mevcut bakiyeniz: ₺{balance.toFixed(2)}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


