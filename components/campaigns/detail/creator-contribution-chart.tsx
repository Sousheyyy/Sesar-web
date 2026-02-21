"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Users } from "lucide-react";

interface CreatorData {
  name: string;
  sharePercent: number;
  points: number;
  earnings: number;
  isCapped: boolean;
}

interface CreatorContributionChartProps {
  creators: CreatorData[];
  capPercent?: number;
}

export function CreatorContributionChart({ creators, capPercent = 40 }: CreatorContributionChartProps) {
  if (creators.length === 0) {
    return (
      <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Üretici Katkı Payları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-sm text-zinc-500">
            Henüz veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedData = [...creators].sort((a, b) => b.sharePercent - a.sharePercent).slice(0, 15);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as CreatorData;
      return (
        <div className="rounded-lg border border-white/10 bg-zinc-900/95 p-2.5 shadow-xl">
          <p className="text-xs font-medium text-white">{data.name}</p>
          <p className="text-sm font-bold text-white">%{data.sharePercent.toFixed(2)}</p>
          {data.isCapped && (
            <p className="text-xs text-orange-400">Robin Hood limiti uygulandı</p>
          )}
        </div>
      );
    }
    return null;
  };

  const chartHeight = Math.max(250, sortedData.length * 36);

  return (
    <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Üretici Katkı Payları
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              domain={[0, Math.max(capPercent + 5, ...sortedData.map(d => d.sharePercent + 2))]}
              tickFormatter={(v) => `%${v}`}
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
            <ReferenceLine
              x={capPercent}
              stroke="#f97316"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `%${capPercent} Limit`,
                position: "top",
                fill: "#f97316",
                fontSize: 11,
              }}
            />
            <Bar dataKey="sharePercent" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {sortedData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.isCapped ? "#f97316" : "#a855f7"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
