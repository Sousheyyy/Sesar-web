"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TURKISH_MONTHS, TURKISH_DAYS_SHORT } from "./campaign-constants";
import { getCalendarDays } from "./campaign-utils";

interface DoubleMonthCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateClick: (date: Date) => void;
  minDate?: Date;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DoubleMonthCalendar({ startDate, endDate, onDateClick, minDate }: DoubleMonthCalendarProps) {
  const [leftMonth, setLeftMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const rightMonth = useMemo(() => {
    return leftMonth.month === 11
      ? { year: leftMonth.year + 1, month: 0 }
      : { year: leftMonth.year, month: leftMonth.month + 1 };
  }, [leftMonth]);

  const leftDays = useMemo(() => getCalendarDays(leftMonth.year, leftMonth.month), [leftMonth]);
  const rightDays = useMemo(() => getCalendarDays(rightMonth.year, rightMonth.month), [rightMonth]);

  const effectiveMinDate = useMemo(() => {
    if (minDate) return minDate;
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [minDate]);

  const isDisabled = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < effectiveMinDate;
  };

  const isInRange = (date: Date) => {
    if (!startDate) return false;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);

    if (endDate) {
      const e = new Date(endDate);
      e.setHours(0, 0, 0, 0);
      return d > s && d < e;
    }

    // Preview range on hover
    if (hoveredDate && !endDate) {
      const h = new Date(hoveredDate);
      h.setHours(0, 0, 0, 0);
      if (h > s) {
        return d > s && d < h;
      }
    }

    return false;
  };

  const isStart = (date: Date) => startDate ? isSameDay(date, startDate) : false;
  const isEnd = (date: Date) => endDate ? isSameDay(date, endDate) : false;
  const isHovered = (date: Date) => hoveredDate ? isSameDay(date, hoveredDate) : false;

  const prevMonth = () => {
    setLeftMonth(prev =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 }
    );
  };

  const nextMonth = () => {
    setLeftMonth(prev =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 }
    );
  };

  const renderMonth = (days: (Date | null)[], monthLabel: string) => (
    <div className="flex-1 min-w-0">
      <div className="text-center text-sm font-semibold mb-3">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-0.5 mb-1.5">
        {TURKISH_DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[11px] text-muted-foreground font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((date, idx) => {
          if (!date) return <div key={`e-${idx}`} className="h-9" />;

          const disabled = isDisabled(date);
          const start = isStart(date);
          const end = isEnd(date);
          const inRange = isInRange(date);
          const hovered = isHovered(date) && !endDate && startDate && !disabled;

          return (
            <div key={idx} className="flex items-center justify-center h-9">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDateClick(date)}
                onMouseEnter={() => !disabled && setHoveredDate(date)}
                onMouseLeave={() => setHoveredDate(null)}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-colors",
                  disabled && "text-muted-foreground/30 cursor-not-allowed",
                  !disabled && !start && !end && !inRange && !hovered && "text-foreground hover:bg-muted",
                  start && "bg-primary text-primary-foreground",
                  end && "bg-violet-500 text-white",
                  inRange && !start && !end && "bg-primary/15 text-primary",
                  hovered && !start && "bg-primary/10 text-primary ring-1 ring-primary/30"
                )}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-8 text-sm font-semibold">
          <span>{TURKISH_MONTHS[leftMonth.month]} {leftMonth.year}</span>
          <span>{TURKISH_MONTHS[rightMonth.month]} {rightMonth.year}</span>
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid - 2 months */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {renderMonth(leftDays, `${TURKISH_MONTHS[leftMonth.month]} ${leftMonth.year}`)}
        {renderMonth(rightDays, `${TURKISH_MONTHS[rightMonth.month]} ${rightMonth.year}`)}
      </div>
    </div>
  );
}
