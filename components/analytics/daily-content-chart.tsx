"use client";

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
import { formatNumber } from "@/lib/utils";

export interface DailyContentDataPoint {
  date: string;
  dateLabel: string;
  campaignCount: number;
  submissions: number;
  views: number;
  likes: number;
  shares: number;
}

interface DailyContentChartProps {
  data: DailyContentDataPoint[];
}

export function DailyContentChart({ data }: DailyContentChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as DailyContentDataPoint;
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl min-w-[240px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-700">
            <p className="text-sm font-medium text-white">{d.dateLabel}</p>
            <span className="text-xs bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">
              {d.campaignCount.toLocaleString("tr-TR")} kampanya
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6]" />
                <span className="text-sm text-zinc-300">Gönderiler</span>
              </div>
              <span className="text-sm font-semibold text-white">{d.submissions.toLocaleString("tr-TR")}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
                <span className="text-sm text-zinc-300">Görüntülenme</span>
              </div>
              <span className="text-sm font-semibold text-cyan-400">{d.views.toLocaleString("tr-TR")}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
                <span className="text-sm text-zinc-300">Beğeni</span>
              </div>
              <span className="text-sm font-semibold text-pink-400">{d.likes.toLocaleString("tr-TR")}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                <span className="text-sm text-zinc-300">Paylaşım</span>
              </div>
              <span className="text-sm font-semibold text-green-400">{d.shares.toLocaleString("tr-TR")}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const isEmpty = data.length === 0 || data.every(
    (d) => d.submissions === 0 && d.views === 0 && d.likes === 0 && d.shares === 0
  );

  if (isEmpty) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500">
        Hen\u00FCz veri bulunmuyor
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatNumber(value)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatNumber(value)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              submissions: "Gönderiler",
              views: "Görüntülenme",
              likes: "Beğeni",
              shares: "Paylaşım",
            };
            return labels[value] || value;
          }}
          wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
        />
        <Bar yAxisId="left" dataKey="submissions" fill="#8b5cf6" name="submissions" radius={[4, 4, 0, 0]} barSize={24} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="views"
          stroke="#06b6d4"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#06b6d4", strokeWidth: 2, stroke: "#fff" }}
          name="views"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="likes"
          stroke="#f43f5e"
          strokeWidth={2}
          dot={{ r: 3, fill: "#f43f5e", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#f43f5e", strokeWidth: 2, stroke: "#fff" }}
          name="likes"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="shares"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }}
          name="shares"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
