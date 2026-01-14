"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface ApiCallDataPoint {
  date: string;
  [endpoint: string]: string | number; // Dynamic endpoints as keys
}

interface ApiCallsChartProps {
  data: ApiCallDataPoint[];
  endpoints: string[];
  title?: string;
  description?: string;
  onDateClick?: (date: string) => void;
}

const ENDPOINT_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)", // green
  "hsl(217, 91%, 60%)", // blue
  "hsl(38, 92%, 50%)", // yellow
  "hsl(0, 84%, 60%)", // red
  "hsl(280, 100%, 70%)", // purple
  "hsl(180, 100%, 50%)", // cyan
];

export function ApiCallsChart({
  data,
  endpoints,
  title = "API Çağrıları",
  description = "Endpoint bazında API çağrı istatistikleri",
  onDateClick,
}: ApiCallsChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: new Date(item.date).toLocaleDateString("tr-TR", {
      month: "short",
      day: "numeric",
    }),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const date = payload[0].payload.date;
      return (
        <div 
          className={`rounded-lg border bg-background p-3 shadow-sm ${onDateClick ? "cursor-pointer hover:bg-accent transition-colors" : ""}`}
          onClick={() => {
            if (onDateClick && date) {
              onDateClick(date);
            }
          }}
        >
          <p className="text-sm font-medium mb-2">
            {payload[0].payload.dateLabel}
            {onDateClick && (
              <span className="ml-2 text-xs text-muted-foreground">(Tıklayarak detayları görüntüle)</span>
            )}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <p
                key={index}
                className="text-sm font-semibold"
                style={{ color: entry.color }}
              >
                {entry.name}: {formatNumber(entry.value)} çağrı
              </p>
            ))}
            <p className="text-xs text-muted-foreground pt-1 border-t mt-1">
              Toplam: {formatNumber(
                payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0)
              )} çağrı
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const formatEndpointName = (endpoint: string) => {
    // Format endpoint for display
    if (endpoint.startsWith("/api/")) {
      return endpoint.replace("/api/", "").replace(/\//g, " / ");
    }
    return endpoint;
  };

  if (data.length === 0 || endpoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Henüz veri yok
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
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length > 0) {
                const date = e.activePayload[0].payload.date;
                if (date && onDateClick) {
                  onDateClick(date);
                }
              }
            }}
            style={{ cursor: onDateClick ? "pointer" : "default" }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateLabel"
              className="text-xs"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="text-xs"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 2, opacity: 0.5 }}
            />
            <Legend
              formatter={(value) => formatEndpointName(value)}
              wrapperStyle={{ fontSize: "11px" }}
            />
            {endpoints.map((endpoint, index) => (
              <Line
                key={endpoint}
                type="monotone"
                dataKey={endpoint}
                stroke={ENDPOINT_COLORS[index % ENDPOINT_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                name={endpoint}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

