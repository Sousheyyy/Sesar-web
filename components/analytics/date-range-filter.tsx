"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { DatePicker } from "@/components/ui/new-date-picker";
import { Card } from "@/components/ui/card";

export function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    // Initialize from URL params
    const start = searchParams?.get("startDate");
    const end = searchParams?.get("endDate");
    
    if (start) {
      setStartDate(new Date(start));
    }
    if (end) {
      setEndDate(new Date(end));
    }
  }, [searchParams]);

  const handleApply = () => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    
    if (startDate) {
      params.set("startDate", startDate.toISOString().split("T")[0]);
    } else {
      params.delete("startDate");
    }
    
    if (endDate) {
      params.set("endDate", endDate.toISOString().split("T")[0]);
    } else {
      params.delete("endDate");
    }
    
    router.push(`/admin/analytics?${params.toString()}`);
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    router.push("/admin/analytics");
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Başlangıç Tarihi
            </label>
            <DatePicker
              date={startDate || undefined}
              setDate={(date) => setStartDate(date || null)}
              placeholder="Başlangıç tarihi seçin"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Bitiş Tarihi
            </label>
            <DatePicker
              date={endDate || undefined}
              setDate={(date) => setEndDate(date || null)}
              placeholder="Bitiş tarihi seçin"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleApply} variant="default">
            <Calendar className="h-4 w-4 mr-2" />
            Uygula
          </Button>
          {(startDate || endDate) && (
            <Button onClick={handleClear} variant="outline">
              Temizle
            </Button>
          )}
        </div>
      </div>
      {(startDate || endDate) && (
        <div className="mt-3 text-sm text-muted-foreground">
          {startDate && endDate && (
            <span>
              {format(startDate, "d MMM yyyy", { locale: tr })} - {format(endDate, "d MMM yyyy", { locale: tr })}
            </span>
          )}
          {startDate && !endDate && (
            <span>{format(startDate, "d MMM yyyy", { locale: tr })} - Bugün</span>
          )}
          {!startDate && endDate && (
            <span>Başlangıç - {format(endDate, "d MMM yyyy", { locale: tr })}</span>
          )}
        </div>
      )}
    </Card>
  );
}

