"use client";

import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ComparisonDataPoint {
  date: string;
  revenue: number;
  payouts: number;
}

interface RevenuePayoutsComparisonProps {
  data: ComparisonDataPoint[];
  title?: string;
  description?: string;
}

export function RevenuePayoutsComparison({
  data,
}: RevenuePayoutsComparisonProps) {
  const formattedData = data
    .filter((item) => {
      const date = new Date(item.date);
      return !isNaN(date.getTime());
    })
    .map((item) => {
      const revenue = typeof item.revenue === "number" ? item.revenue : Number(item.revenue) || 0;
      const payouts = typeof item.payouts === "number" ? item.payouts : Number(item.payouts) || 0;

      return {
        date: item.date,
        revenue: Math.max(0, revenue),
        payouts: Math.max(0, payouts),
        dateLabel: new Date(item.date).toLocaleDateString("tr-TR", {
          month: "short",
          day: "numeric",
        }),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const fmtCurrency = (v: number) =>
    v.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL";

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const revenue = typeof d.revenue === "number" ? d.revenue : Number(d.revenue) || 0;
      const payouts = typeof d.payouts === "number" ? d.payouts : Number(d.payouts) || 0;
      const net = revenue - payouts;

      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <p className="text-sm font-medium text-white mb-2">{d.dateLabel}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <p className="text-sm text-zinc-300">Gelir: <span className="font-semibold text-emerald-400">{fmtCurrency(revenue)}</span></p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <p className="text-sm text-zinc-300">{"\u00D6"}demeler: <span className="font-semibold text-red-400">{fmtCurrency(payouts)}</span></p>
            </div>
            <div className="pt-1 mt-1 border-t border-zinc-700">
              <p className="text-xs text-zinc-400">
                Net: <span className={net >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtCurrency(net)}</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const isEmpty = formattedData.length === 0 || formattedData.every(
    (d) => d.revenue === 0 && d.payouts === 0
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
      <ComposedChart
        data={formattedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorPayouts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
          </linearGradient>
        </defs>
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
            if (value === "revenue") return "Gelir";
            if (value === "payouts") return "Ödemeler";
            return value;
          }}
          wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          fill="url(#colorRevenue)"
          stroke="#34d399"
          strokeWidth={2}
          name="revenue"
        />
        <Area
          type="monotone"
          dataKey="payouts"
          fill="url(#colorPayouts)"
          stroke="#f87171"
          strokeWidth={2}
          name="payouts"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
