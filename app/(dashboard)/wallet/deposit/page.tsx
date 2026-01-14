"use client";

import { useState } from "react";
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

export default function DepositPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    reference: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Geçerli bir tutar girin");
      return;
    }

    if (amount < 50) {
      toast.error("Minimum yatırım tutarı ₺50'dır");
      return;
    }

    if (amount > 99999999.99) {
      toast.error("Maksimum yatırım tutarı ₺99,999,999.99'dur");
      return;
    }

    if (!formData.reference) {
      toast.error("Lütfen banka referans numarasını girin");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/transactions/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reference: formData.reference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Para yatırma talebi oluşturulamadı");
      }

      toast.success("Para yatırma talebi gönderildi! Yönetici onayı bekleniyor.");
      router.push("/wallet");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Para yatırma talebi gönderilemedi");
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
          <h2 className="text-3xl font-bold tracking-tight">Para Yatır</h2>
          <p className="text-muted-foreground">
            TikPay cüzdanınıza para ekleyin
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Banka Havalesi Talimatları</CardTitle>
          <CardDescription>
            Hesabınıza para yatırmak için bu adımları izleyin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-semibold">Banka Hesap Detayları</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Banka Adı:</span>
                <span className="font-medium">TikPay Bank</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hesap Adı:</span>
                <span className="font-medium">TikPay Inc.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hesap Numarası:</span>
                <span className="font-medium">1234567890</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Yönlendirme Numarası:</span>
                <span className="font-medium">987654321</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-semibold">Adımlar:</h4>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Yukarıdaki banka hesabına istediğiniz tutarı transfer edin</li>
                <li>Banka referans/işlem numarasını not edin</li>
                <li>Aşağıdaki formu tutar ve referans ile doldurun</li>
                <li>Formu gönderin ve yönetici onayını bekleyin</li>
                <li>Onaylandıktan sonra, para cüzdanınıza eklenecektir</li>
              </ol>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Yatırım Tutarı (₺) * (Min: ₺50)</Label>
              <Input
                id="amount"
                type="number"
                min="50"
                max="99999999.99"
                step="0.01"
                placeholder="100"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Banka Referans Numarası *</Label>
              <Input
                id="reference"
                placeholder="örn., TXN123456789"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Banka havalenizdeki işlem referansını girin
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Gönderiliyor..." : "Para Yatırma Talebi Gönder"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


