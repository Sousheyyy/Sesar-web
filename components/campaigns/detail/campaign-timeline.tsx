import { cn } from "@/lib/utils";
import { Check, Clock, Lock, Flag, Plus, Pause, XCircle } from "lucide-react";

interface CampaignTimelineProps {
  createdAt: Date;
  startDate: Date | null;
  endDate: Date | null;
  lockedAt: Date | null;
  completedAt: Date | null;
  status: string;
  durationDays: number;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const isFuture = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);
  const diffMins = Math.floor(absDiffMs / 60000);
  const diffHours = Math.floor(absDiffMs / 3600000);
  const diffDays = Math.floor(absDiffMs / 86400000);

  if (diffMins < 1) return "Az önce";

  const suffix = isFuture ? "sonra" : "önce";

  if (diffMins < 60) return `${diffMins} dk ${suffix}`;
  if (diffHours < 24) return `${diffHours} saat ${suffix}`;
  if (diffDays < 30) return `${diffDays} gün ${suffix}`;

  return new Date(date).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(date: Date): string {
  return new Date(date).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TimelineStep {
  label: string;
  date: Date | null;
  icon: React.ReactNode;
  status: "completed" | "active" | "upcoming" | "skipped";
}

export function CampaignTimeline({
  createdAt,
  startDate,
  endDate,
  lockedAt,
  completedAt,
  status,
  durationDays,
}: CampaignTimelineProps) {
  const now = new Date();

  const steps: TimelineStep[] = [
    {
      label: "Oluşturuldu",
      date: createdAt,
      icon: <Plus className="h-3.5 w-3.5" />,
      status: "completed",
    },
    {
      label: "Onaylandı & Başladı",
      date: startDate,
      icon: <Flag className="h-3.5 w-3.5" />,
      status: startDate ? "completed" :
              status === "REJECTED" ? "skipped" : "upcoming",
    },
    {
      label: "Kilitlendi",
      date: lockedAt,
      icon: <Lock className="h-3.5 w-3.5" />,
      status: lockedAt ? "completed" :
              status === "COMPLETED" ? "completed" :
              (status === "ACTIVE" || status === "PAUSED") ? "upcoming" : "upcoming",
    },
    {
      label: status === "CANCELLED" ? "İptal Edildi" :
             status === "PAUSED" ? "Duraklatıldı" :
             "Tamamlandı",
      date: completedAt || (status === "CANCELLED" ? new Date() : null),
      icon: status === "CANCELLED" ? <XCircle className="h-3.5 w-3.5" /> :
            status === "PAUSED" ? <Pause className="h-3.5 w-3.5" /> :
            <Check className="h-3.5 w-3.5" />,
      status: completedAt ? "completed" :
              status === "ACTIVE" ? "active" :
              status === "PAUSED" ? "active" :
              status === "CANCELLED" ? "completed" : "upcoming",
    },
  ];

  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0",
                  step.status === "completed"
                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                    : step.status === "active"
                    ? "bg-purple-500/20 border-purple-500/50 text-purple-400 animate-pulse"
                    : step.status === "skipped"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-white/5 border-white/10 text-zinc-600"
                )}
              >
                {step.icon}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[24px]",
                    step.status === "completed"
                      ? "bg-green-500/30"
                      : "bg-white/5"
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 pt-0.5">
              <p className={cn(
                "text-sm font-medium",
                step.status === "completed" ? "text-white" :
                step.status === "active" ? "text-purple-300" :
                "text-zinc-600"
              )}>
                {step.label}
              </p>
              {step.date ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-zinc-500">{formatShortDate(step.date)}</p>
                  <span className="text-xs text-zinc-600">&middot;</span>
                  <p className="text-xs text-zinc-500">{formatRelativeDate(step.date)}</p>
                </div>
              ) : (
                <p className="text-xs text-zinc-600 mt-0.5">
                  {step.status === "upcoming" && endDate
                    ? `Tahmini: ${formatShortDate(endDate)}`
                    : step.status === "upcoming"
                    ? `${durationDays} gün sonra (onay sonrası)`
                    : "—"
                  }
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
