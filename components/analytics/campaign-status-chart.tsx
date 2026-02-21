"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { CampaignStatus } from "@prisma/client";

interface StatusData {
  status: CampaignStatus;
  count: number;
  label: string;
}

interface CampaignStatusChartProps {
  data: StatusData[];
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  ACTIVE: "#22c55e",
  COMPLETED: "#3b82f6",
  PENDING_APPROVAL: "#eab308",
  PAUSED: "#71717a",
  CANCELLED: "#ef4444",
  REJECTED: "#dc2626",
};

export function CampaignStatusChart({ data }: CampaignStatusChartProps) {
  const chartData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      fill: STATUS_COLORS[item.status] || "#71717a",
    }));

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0];
      const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <p className="text-sm font-medium text-white">{d.payload.label}</p>
          <p className="text-sm text-zinc-300">
            {d.value.toLocaleString("tr-TR")} kampanya <span className="text-zinc-500">({pct}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-zinc-500">
        Hen{"\u00FC"}z veri bulunmuyor
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          fill="#8884d8"
          dataKey="count"
          strokeWidth={2}
          stroke="#09090b"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(_value: string, entry: any) => {
            return `${entry.payload.label} (${entry.payload.count})`;
          }}
          wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
