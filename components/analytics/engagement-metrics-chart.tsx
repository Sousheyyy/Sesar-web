"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface EngagementDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

interface EngagementMetricsChartProps {
  data: EngagementDataPoint[];
}

export function EngagementMetricsChart({ data }: EngagementMetricsChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: new Date(item.date).toLocaleDateString("tr-TR", {
      month: "short",
      day: "numeric",
    }),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const labels: Record<string, string> = {
        views: "G\u00F6r\u00FCnt\u00FClenme",
        likes: "Be\u011Feni",
        comments: "Yorum",
        shares: "Payla\u015F\u0131m",
      };
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <p className="text-sm font-medium text-white mb-2">{payload[0].payload.dateLabel}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <p className="text-sm text-zinc-300">
                {labels[entry.dataKey] || entry.name}: <span className="font-semibold text-white">{typeof entry.value === "number" ? entry.value.toLocaleString("tr-TR") : entry.value}</span>
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const isEmpty = data.length === 0 || data.every(
    (d) => d.views === 0 && d.likes === 0 && d.comments === 0 && d.shares === 0
  );

  if (isEmpty) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500">
        Hen\u00FCz veri bulunmuyor
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={formattedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatNumber(value)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              views: "Görüntülenme",
              likes: "Beğeni",
              comments: "Yorum",
              shares: "Paylaşım",
            };
            return labels[value] || value;
          }}
          wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
        />
        <Bar dataKey="views" fill="#8b5cf6" name="views" radius={[4, 4, 0, 0]} />
        <Bar dataKey="likes" fill="#f43f5e" name="likes" radius={[4, 4, 0, 0]} />
        <Bar dataKey="comments" fill="#3b82f6" name="comments" radius={[4, 4, 0, 0]} />
        <Bar dataKey="shares" fill="#22c55e" name="shares" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
