"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";

interface EngagementDataPoint {
  name: string;
  views: number;
  likes: number;
  shares: number;
}

interface EngagementLinesChartProps {
  data: EngagementDataPoint[];
}

const LINES = [
  { key: "views", label: "Görüntülenme", color: "#22d3ee" },
  { key: "likes", label: "Beğeni", color: "#f472b6" },
  { key: "shares", label: "Paylaşım", color: "#4ade80" },
] as const;

export function EngagementLinesChart({ data }: EngagementLinesChartProps) {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    views: true,
    likes: true,
    shares: true,
  });

  const toggle = (key: string) => {
    setVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (data.length === 0) {
    return (
      <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Etkileşim Metrikleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[280px] items-center justify-center text-sm text-zinc-500">
            Henüz veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/10 bg-zinc-900/95 p-3 shadow-xl">
          <p className="text-xs font-medium text-white mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-zinc-400">{entry.name}</span>
                </div>
                <span className="font-medium text-white">{formatNumber(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Etkileşim Metrikleri
          </CardTitle>

          {/* Toggle buttons */}
          <div className="flex items-center gap-2">
            {LINES.map(line => (
              <button
                key={line.key}
                onClick={() => toggle(line.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border",
                  visible[line.key]
                    ? "border-white/20 bg-white/5 text-white"
                    : "border-white/5 bg-transparent text-zinc-600 hover:text-zinc-400"
                )}
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-opacity",
                    visible[line.key] ? "opacity-100" : "opacity-30"
                  )}
                  style={{ backgroundColor: line.color }}
                />
                {line.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={data.length > 8 ? -30 : 0}
              textAnchor={data.length > 8 ? "end" : "middle"}
              height={data.length > 8 ? 60 : 30}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />

            {LINES.map(line => (
              visible[line.key] && (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={{ fill: line.color, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: line.color, strokeWidth: 2, fill: "#0a0a0b" }}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
