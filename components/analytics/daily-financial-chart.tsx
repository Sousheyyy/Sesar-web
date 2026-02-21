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

export interface DailyFinancialDataPoint {
  date: string;
  dateLabel: string;
  campaignCount: number;
  totalBudget: number;
  commission: number;
  payouts: number;
}

interface DailyFinancialChartProps {
  data: DailyFinancialDataPoint[];
}

export function DailyFinancialChart({ data }: DailyFinancialChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as DailyFinancialDataPoint;
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
                <span className="text-sm text-zinc-300">Toplam Bütçe</span>
              </div>
              <span className="text-sm font-semibold text-white">{d.totalBudget.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" />
                <span className="text-sm text-zinc-300">Komisyon (Gelir)</span>
              </div>
              <span className="text-sm font-semibold text-emerald-400">{d.commission.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
                <span className="text-sm text-zinc-300">Ödemeler</span>
              </div>
              <span className="text-sm font-semibold text-red-400">{d.payouts.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const isEmpty = data.length === 0 || data.every(
    (d) => d.totalBudget === 0 && d.commission === 0 && d.payouts === 0
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
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => {
            if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
            return `₺${value}`;
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              totalBudget: "Toplam Bütçe",
              commission: "Komisyon (Gelir)",
              payouts: "Ödemeler",
            };
            return labels[value] || value;
          }}
          wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
        />
        <Bar dataKey="totalBudget" fill="#8b5cf6" name="totalBudget" radius={[4, 4, 0, 0]} barSize={20} />
        <Bar dataKey="commission" fill="#22c55e" name="commission" radius={[4, 4, 0, 0]} barSize={20} />
        <Line
          type="monotone"
          dataKey="payouts"
          stroke="#f43f5e"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#f43f5e", strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "#f43f5e", strokeWidth: 2, stroke: "#fff" }}
          name="payouts"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
