import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ProgressItem {
  current: number;
  required: number;
}

interface CampaignHealthCardProps {
  insurancePassed: boolean;
  submissionProgress: ProgressItem;
  pointsProgress: ProgressItem;
  viewsProgress: ProgressItem;
  status: string;
}

function HealthGauge({ label, current, required }: { label: string; current: number; required: number }) {
  const percent = Math.min((current / required) * 100, 100);
  const isComplete = current >= required;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className={cn("font-medium", isComplete ? "text-green-400" : "text-zinc-300")}>
          {formatNumber(current)} / {formatNumber(required)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isComplete
              ? "bg-gradient-to-r from-green-500 to-emerald-400"
              : percent >= 50
              ? "bg-gradient-to-r from-yellow-500 to-amber-400"
              : "bg-gradient-to-r from-red-500 to-orange-400"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function CampaignHealthCard({
  insurancePassed,
  submissionProgress,
  pointsProgress,
  viewsProgress,
  status,
}: CampaignHealthCardProps) {
  const gauges = [submissionProgress, pointsProgress, viewsProgress];
  const passedCount = gauges.filter(g => g.current >= g.required).length;
  const healthScore = Math.round(
    gauges.reduce((sum, g) => sum + Math.min(g.current / g.required, 1), 0) / 3 * 100
  );

  const isCompleted = status === "COMPLETED";

  return (
    <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            {insurancePassed ? (
              <ShieldCheck className="h-4 w-4 text-green-400" />
            ) : passedCount >= 2 ? (
              <Shield className="h-4 w-4 text-yellow-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-red-400" />
            )}
            Kampanya Sağlığı
          </CardTitle>
          <Badge
            variant={insurancePassed ? "success" : passedCount >= 2 ? "warning" : "destructive"}
            className="text-xs"
          >
            {isCompleted
              ? insurancePassed ? "Sigorta Geçti" : "Sigorta Tetiklendi"
              : insurancePassed ? "Sağlıklı" : passedCount >= 2 ? "Riskli" : "Kritik"
            }
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <HealthGauge
          label="Gönderiler"
          current={submissionProgress.current}
          required={submissionProgress.required}
        />
        <HealthGauge
          label="Puanlar"
          current={pointsProgress.current}
          required={pointsProgress.required}
        />
        <HealthGauge
          label="Görüntülenme"
          current={viewsProgress.current}
          required={viewsProgress.required}
        />

        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Genel Skor</span>
            <span className={cn(
              "font-bold text-lg",
              healthScore >= 80 ? "text-green-400" :
              healthScore >= 50 ? "text-yellow-400" : "text-red-400"
            )}>
              %{healthScore}
            </span>
          </div>
        </div>

        {!insurancePassed && !isCompleted && (
          <div className="flex items-start gap-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-400/80">
              Sigorta eşikleri karşılanmadığında, bütçe kampanya sonunda sanatçıya iade edilir.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
