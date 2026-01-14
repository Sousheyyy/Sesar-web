"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiCallsChart } from "./api-calls-chart";
import { ApiCallsDetailsModal } from "./api-calls-details-modal";

interface ApiCallDataPoint {
  date: string;
  [endpoint: string]: string | number;
}

export function ApiCallsChartClient() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiCallDataPoint[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchApiCalls() {
      try {
        setIsLoading(true);
        
        // Build query params
        const params = new URLSearchParams();
        const startDate = searchParams?.get("startDate");
        const endDate = searchParams?.get("endDate");
        
        if (startDate) {
          params.set("startDate", startDate);
        }
        if (endDate) {
          params.set("endDate", endDate);
        }
        
        // If no date filter, use default 30 days
        if (!startDate && !endDate) {
          params.set("days", "30");
        }
        
        const response = await fetch(`/api/admin/analytics/api-calls?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch API calls");
        }

        const result = await response.json();
        setData(result.data || []);
        setEndpoints(result.endpoints || []);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching API calls:", err);
        setError(err.message || "Failed to load API call data");
        setData([]);
        setEndpoints([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchApiCalls();
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-destructive">
        Hata: {error}
      </div>
    );
  }

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  return (
    <>
      <ApiCallsChart
        data={data}
        endpoints={endpoints}
        onDateClick={handleDateClick}
      />
      <ApiCallsDetailsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        date={selectedDate}
        limit={50}
      />
    </>
  );
}

