"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, DollarSign } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

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
  title?: string;
  description?: string;
}

const ALERT_ICONS = {
  warning: AlertTriangle,
  info: Clock,
  success: CheckCircle,
  error: AlertTriangle,
};

const ALERT_COLORS = {
  warning: "text-yellow-600",
  info: "text-blue-600",
  success: "text-green-600",
  error: "text-red-600",
};

const ALERT_BG_COLORS = {
  warning: "bg-yellow-50 border-yellow-200",
  info: "bg-blue-50 border-blue-200",
  success: "bg-green-50 border-green-200",
  error: "bg-red-50 border-red-200",
};

export function AlertsSection({
  alerts,
  title = "Uyarılar ve Bildirimler",
  description = "Dikkat gerektiren öğeler",
}: AlertsSectionProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
            Tüm sistemler normal çalışıyor
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => {
            const Icon = ALERT_ICONS[alert.type];
            return (
              <div
                key={alert.id}
                className={`rounded-lg border p-4 ${ALERT_BG_COLORS[alert.type]}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className={`h-5 w-5 mt-0.5 ${ALERT_COLORS[alert.type]}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{alert.title}</h4>
                        {alert.count !== undefined && (
                          <Badge variant="outline">{alert.count}</Badge>
                        )}
                        {alert.amount !== undefined && (
                          <Badge variant="outline">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {formatCurrency(alert.amount)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                  {alert.link && (
                    <Link href={alert.link}>
                      <Button variant="outline" size="sm">
                        {alert.linkText || "Görüntüle"}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}






