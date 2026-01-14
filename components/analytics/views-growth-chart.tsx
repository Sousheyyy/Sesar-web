"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface ViewsDataPoint {
  date: string;
  views: number;
  cumulative?: number;
}

interface ViewsGrowthChartProps {
  data: ViewsDataPoint[];
  title?: string;
  description?: string;
  showCumulative?: boolean;
}

export function ViewsGrowthChart({
  data,
  title = "Görüntülenme Büyümesi",
  description = "Zaman içinde görüntülenme artışı",
  showCumulative = false,
}: ViewsGrowthChartProps) {
  // Format dates for display
  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: new Date(item.date).toLocaleDateString("tr-TR", {
      month: "short",
      day: "numeric",
    }),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/10 bg-[#0A0A0B]/90 backdrop-blur-xl p-3 shadow-lg">
          <p className="text-sm font-medium text-white">{payload[0].payload.dateLabel}</p>
          <p className="text-sm font-bold text-purple-400">
            {formatNumber(payload[0].value)} görüntülenme
          </p>
          {showCumulative && payload[0].payload.cumulative !== undefined && (
            <p className="text-xs text-zinc-400 mt-1">
              Toplam: {formatNumber(payload[0].payload.cumulative)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-white">{title}</CardTitle>
          <CardDescription className="text-zinc-400">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500">
            Henüz veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-white">{title}</CardTitle>
        <CardDescription className="text-zinc-400">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-white/5" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              className="text-xs"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71717a" }} // Zinc-500
              minTickGap={30}
            />
            <YAxis
              className="text-xs"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatNumber(value)}
              tick={{ fill: "#71717a" }} // Zinc-500
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={showCumulative ? "cumulative" : "views"}
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#colorViews)"
              activeDot={{ r: 6, fill: "#a855f7", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

