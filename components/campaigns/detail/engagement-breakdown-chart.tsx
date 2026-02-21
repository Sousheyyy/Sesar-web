"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface EngagementBreakdownChartProps {
  viewPoints: number;
  likePoints: number;
  sharePoints: number;
}

const CHART_DATA_CONFIG = [
  { key: "viewPoints", label: "İzlenme Puanları", color: "#22d3ee" },
  { key: "likePoints", label: "Beğeni Puanları", color: "#f472b6" },
  { key: "sharePoints", label: "Paylaşım Puanları", color: "#4ade80" },
] as const;

export function EngagementBreakdownChart({ viewPoints, likePoints, sharePoints }: EngagementBreakdownChartProps) {
  const total = viewPoints + likePoints + sharePoints;

  const data = [
    { name: "İzlenme Puanları", value: viewPoints, color: "#22d3ee" },
    { name: "Beğeni Puanları", value: likePoints, color: "#f472b6" },
    { name: "Paylaşım Puanları", value: sharePoints, color: "#4ade80" },
  ].filter(d => d.value > 0);

  if (total === 0) {
    return (
      <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Etkileşim Dağılımı
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percent = ((payload[0].value / total) * 100).toFixed(1);
      return (
        <div className="rounded-lg border border-white/10 bg-zinc-900/95 p-2.5 shadow-xl">
          <p className="text-xs text-zinc-400">{payload[0].name}</p>
          <p className="text-sm font-bold text-white">{formatNumber(payload[0].value)} tp</p>
          <p className="text-xs text-zinc-500">%{percent}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Etkileşim Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs text-zinc-500">Toplam</p>
            <p className="text-lg font-bold text-white">{formatNumber(total)} tp</p>
          </div>
        </div>

        {/* Legend with percentages */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {CHART_DATA_CONFIG.map((config) => {
            const value = config.key === "viewPoints" ? viewPoints :
                          config.key === "likePoints" ? likePoints : sharePoints;
            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
            return (
              <div key={config.key} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }} />
                  <span className="text-xs text-zinc-500">{config.label.split(" ")[0]}</span>
                </div>
                <p className="text-sm font-semibold text-white">%{percent}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
