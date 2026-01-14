"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

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
  title = "Gelir vs Ödemeler",
  description = "Gelir ve ödemeler karşılaştırması",
}: RevenuePayoutsComparisonProps) {
  // Validate and format data
  const formattedData = data
    .filter((item) => {
      // Validate date
      const date = new Date(item.date);
      if (isNaN(date.getTime())) {
        console.warn("Invalid date in revenue-payouts data:", item);
        return false;
      }
      return true;
    })
    .map((item) => {
      // Ensure revenue and payouts are numbers
      const revenue = typeof item.revenue === "number" ? item.revenue : Number(item.revenue) || 0;
      const payouts = typeof item.payouts === "number" ? item.payouts : Number(item.payouts) || 0;
      
      return {
        date: item.date,
        revenue: Math.max(0, revenue), // Ensure non-negative
        payouts: Math.max(0, payouts), // Ensure non-negative
        dateLabel: new Date(item.date).toLocaleDateString("tr-TR", {
          month: "short",
          day: "numeric",
        }),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date)); // Ensure sorted by date

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const revenue = typeof data.revenue === "number" ? data.revenue : Number(data.revenue) || 0;
      const payouts = typeof data.payouts === "number" ? data.payouts : Number(data.payouts) || 0;
      const net = revenue - payouts;
      
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <p className="text-sm font-medium mb-2">{data.dateLabel}</p>
          <div className="space-y-1">
            <p className="text-sm font-semibold" style={{ color: "hsl(142, 76%, 36%)" }}>
              Gelir: {formatCurrency(revenue)}
            </p>
            <p className="text-sm font-semibold" style={{ color: "hsl(0, 84%, 60%)" }}>
              Ödemeler: {formatCurrency(payouts)}
            </p>
            <p className="text-xs text-muted-foreground pt-1 border-t">
              Net: {formatCurrency(net)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Henüz veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPayouts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateLabel"
              className="text-xs"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="text-xs"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => {
                if (value >= 1000) {
                  return `₺${(value / 1000).toFixed(0)}K`;
                }
                return `₺${value}`;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => {
                if (value === "revenue") return "Gelir";
                if (value === "payouts") return "Ödemeler";
                return value;
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              fill="url(#colorRevenue)"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              name="revenue"
            />
            <Area
              type="monotone"
              dataKey="payouts"
              fill="url(#colorPayouts)"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              name="payouts"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

