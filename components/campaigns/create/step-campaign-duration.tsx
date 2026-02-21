"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUICK_DURATIONS, TURKISH_MONTHS } from "./campaign-constants";
import { DoubleMonthCalendar } from "./double-month-calendar";

interface StepCampaignDurationProps {
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number;
  onDateClick: (date: Date) => void;
  onQuickSelect: (days: number) => void;
}

export function StepCampaignDuration({
  startDate,
  endDate,
  durationDays,
  onDateClick,
  onQuickSelect,
}: StepCampaignDurationProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">3</span>
          Kampanya Süresi
        </h3>
        {durationDays > 0 && (
          <Badge variant="outline" className="text-primary border-primary font-bold">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            {durationDays} gün
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <DoubleMonthCalendar
            startDate={startDate}
            endDate={endDate}
            onDateClick={onDateClick}
          />

          {/* Quick select buttons */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Hızlı Seçim</p>
            <div className="flex gap-2">
              {QUICK_DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onQuickSelect(d)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border",
                    durationDays === d
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-muted hover:border-primary/50"
                  )}
                >
                  {d} gün
                </button>
              ))}
            </div>
          </div>

          {/* Date summary */}
          {startDate && (
            <div className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="text-primary font-semibold">
                Başlangıç: {startDate.getDate()} {TURKISH_MONTHS[startDate.getMonth()]}
              </span>
              {endDate ? (
                <span className="text-violet-500 font-semibold">
                  Bitiş: {endDate.getDate()} {TURKISH_MONTHS[endDate.getMonth()]}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">Bitiş tarihini seçin</span>
              )}
            </div>
          )}

          {!startDate && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Takvimden başlangıç ve bitiş tarihlerini seçin
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
