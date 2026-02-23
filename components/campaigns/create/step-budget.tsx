"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TLIcon } from "@/components/icons/tl-icon";
import { ShieldCheck } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { MIN_BUDGET, MAX_BUDGET } from "./campaign-constants";

function getInsuranceThresholds(totalBudget: number) {
  if (totalBudget >= 100000) return { minSubmissions: 15, minPoints: 15_000, minViews: 1_500_000 };
  if (totalBudget >= 70000)  return { minSubmissions: 8,  minPoints: 5_000,  minViews: 500_000 };
  if (totalBudget >= 40000)  return { minSubmissions: 5,  minPoints: 2_000,  minViews: 200_000 };
  return { minSubmissions: 3, minPoints: 500, minViews: 50_000 };
}

interface StepBudgetProps {
  totalBudget: string;
  onBudgetChange: (val: string) => void;
  walletBalance: number;
}

export function StepBudget({
  totalBudget,
  onBudgetChange,
  walletBalance,
}: StepBudgetProps) {
  const budget = parseFloat(totalBudget) || 0;
  const remainingBalance = walletBalance - budget;
  const thresholds = getInsuranceThresholds(budget);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">4</span>
        Toplam Bütçe
      </h3>

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Budget input */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Bütçe Belirleyin</Label>
            <div className="relative">
              <TLIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="number"
                min={MIN_BUDGET}
                max={MAX_BUDGET}
                placeholder="25000"
                className="pl-12 h-14 text-2xl font-bold"
                value={totalBudget}
                onChange={(e) => onBudgetChange(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Min: {formatCurrency(MIN_BUDGET)}</span>
              <span>Max: {formatCurrency(MAX_BUDGET)}</span>
            </div>
          </div>

          {/* Wallet info */}
          <Separator />
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mevcut Bakiye</span>
              <span className="font-medium">{formatCurrency(walletBalance)}</span>
            </div>
            {budget > 0 && (
              <div className={cn(
                "flex justify-between text-sm",
                remainingBalance < 0 ? "text-red-500" : "text-green-600"
              )}>
                <span>Kalan Bakiye</span>
                <span className="font-bold">{formatCurrency(remainingBalance)}</span>
              </div>
            )}
          </div>

          {/* Insurance info */}
          {budget >= MIN_BUDGET && (
            <>
              <Separator />
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-500">Sigorta Garantisi</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kampanyanız aşağıdaki eşikleri karşılamazsa ödül havuzu (komisyon sonrası bütçe) tamamen iade edilir.
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min. Katılımcı</span>
                    <span className="font-medium">{thresholds.minSubmissions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min. Puan</span>
                    <span className="font-medium">{formatNumber(thresholds.minPoints)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min. Görüntülenme</span>
                    <span className="font-medium">{formatNumber(thresholds.minViews)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
