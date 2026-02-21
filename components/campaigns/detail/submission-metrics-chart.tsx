"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface SubmissionMetric {
  creatorName: string;
  views: number;
  likes: number;
  shares: number;
  engagementRate: number;
  points: number;
}

interface SubmissionMetricsChartProps {
  submissions: SubmissionMetric[];
}

export function SubmissionMetricsChart({ submissions }: SubmissionMetricsChartProps) {
  if (submissions.length === 0) {
    return (
      <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Gönderi Performans Karşılaştırması
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500">
            Henüz veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedData = [...submissions].sort((a, b) => b.views - a.views).slice(0, 20);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as SubmissionMetric;
      return (
        <div className="rounded-lg border border-white/10 bg-zinc-900/95 p-3 shadow-xl">
          <p className="text-xs font-medium text-white mb-2">{data.creatorName}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">Görüntülenme</span>
              <span className="text-cyan-400 font-medium">{formatNumber(data.views)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">Beğeni</span>
              <span className="text-pink-400 font-medium">{formatNumber(data.likes)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">Paylaşım</span>
              <span className="text-green-400 font-medium">{formatNumber(data.shares)}</span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t border-white/10">
              <span className="text-zinc-400">Etkileşim Oranı</span>
              <span className="text-amber-400 font-medium">%{data.engagementRate.toFixed(2)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Gönderi Performans Karşılaştırması
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart
            data={sortedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="creatorName"
              tick={{ fill: "#a1a1aa", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="views"
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `%${v}`}
              domain={[0, "auto"]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
            <Legend
              formatter={(value) => {
                if (value === "views") return "Görüntülenme";
                if (value === "engagementRate") return "Etkileşim Oranı";
                return value;
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Bar
              yAxisId="views"
              dataKey="views"
              name="views"
              fill="#22d3ee"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              fillOpacity={0.8}
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="engagementRate"
              name="engagementRate"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
