"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface SubmissionStatsChartProps {
  approved: number;
  pending: number;
  rejected: number;
}

const COLORS = {
  approved: "#22c55e",
  pending: "#eab308",
  rejected: "#ef4444",
};

const LABELS = {
  approved: "Onaylanan",
  pending: "Bekleyen",
  rejected: "Reddedilen",
};

export function SubmissionStatsChart({ approved, pending, rejected }: SubmissionStatsChartProps) {
  const total = approved + pending + rejected;
  const data = [
    { name: "approved", label: LABELS.approved, value: approved, fill: COLORS.approved },
    { name: "pending", label: LABELS.pending, value: pending, fill: COLORS.pending },
    { name: "rejected", label: LABELS.rejected, value: rejected, fill: COLORS.rejected },
  ].filter((d) => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <p className="text-sm font-medium text-white">{d.label}</p>
          <p className="text-sm text-zinc-300">
            {d.value.toLocaleString("tr-TR")} g{"\u00F6"}nderi <span className="text-zinc-500">({pct}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (total === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-zinc-500">
        Hen{"\u00FC"}z veri bulunmuyor
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            dataKey="value"
            strokeWidth={2}
            stroke="#09090b"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2">
        {[
          { label: "Onaylanan", value: approved, color: COLORS.approved, pct: total > 0 ? ((approved / total) * 100).toFixed(1) : "0" },
          { label: "Bekleyen", value: pending, color: COLORS.pending, pct: total > 0 ? ((pending / total) * 100).toFixed(1) : "0" },
          { label: "Reddedilen", value: rejected, color: COLORS.rejected, pct: total > 0 ? ((rejected / total) * 100).toFixed(1) : "0" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-zinc-300">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{item.value.toLocaleString("tr-TR")}</span>
              <span className="text-zinc-500 text-xs">({item.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
