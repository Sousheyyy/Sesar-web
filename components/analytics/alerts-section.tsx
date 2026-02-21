"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { TLIcon } from "@/components/icons/tl-icon";

interface Alert {
  id: string;
  type: "warning" | "info" | "success" | "error";
  title: string;
  message: string;
  count?: number;
  amount?: number;
  link?: string;
  linkText?: string;
}

interface AlertsSectionProps {
  alerts: Alert[];
}

const ALERT_ICONS = {
  warning: AlertTriangle,
  info: Clock,
  success: CheckCircle,
  error: AlertTriangle,
};

const ALERT_STYLES = {
  warning: {
    bg: "bg-yellow-500/10 border-yellow-500/20",
    icon: "text-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  },
  info: {
    bg: "bg-blue-500/10 border-blue-500/20",
    icon: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  success: {
    bg: "bg-green-500/10 border-green-500/20",
    icon: "text-green-400",
    badge: "bg-green-500/20 text-green-300 border-green-500/30",
  },
  error: {
    bg: "bg-red-500/10 border-red-500/20",
    icon: "text-red-400",
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
  },
};

export function AlertsSection({ alerts }: AlertsSectionProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const Icon = ALERT_ICONS[alert.type];
        const styles = ALERT_STYLES[alert.type];
        return (
          <div
            key={alert.id}
            className={`rounded-lg border p-4 ${styles.bg}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className={`h-5 w-5 shrink-0 ${styles.icon}`} />
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h4 className="font-semibold text-sm text-white">{alert.title}</h4>
                  {alert.count !== undefined && (
                    <Badge variant="outline" className={styles.badge}>
                      {alert.count}
                    </Badge>
                  )}
                  {alert.amount !== undefined && (
                    <Badge variant="outline" className={styles.badge}>
                      <TLIcon className="h-3 w-3 mr-0.5" />
                      {formatCurrency(alert.amount)}
                    </Badge>
                  )}
                  <span className="text-sm text-zinc-400 hidden sm:inline">{alert.message}</span>
                </div>
              </div>
              {alert.link && (
                <Link href={alert.link}>
                  <Button variant="outline" size="sm" className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 shrink-0">
                    {alert.linkText || "Görüntüle"}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
