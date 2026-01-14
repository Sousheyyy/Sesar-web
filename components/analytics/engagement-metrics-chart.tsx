"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  title?: string;
  description?: string;
}

export function EngagementMetricsChart({
  data,
  title = "Etkileşim Metrikleri",
  description = "Görüntülenme, beğeni, yorum ve paylaşım istatistikleri",
}: EngagementMetricsChartProps) {
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
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <p className="text-sm font-medium">{payload[0].payload.dateLabel}</p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-sm font-semibold"
              style={{ color: entry.color }}
            >
              {entry.name}: {formatNumber(entry.value)}
            </p>
          ))}
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
          <BarChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
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
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => {
                if (value === "views") return "Görüntülenme";
                if (value === "likes") return "Beğeni";
                if (value === "comments") return "Yorum";
                if (value === "shares") return "Paylaşım";
                return value;
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Bar
              dataKey="views"
              fill="hsl(var(--primary))"
              name="views"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="likes"
              fill="hsl(0, 84%, 60%)"
              name="likes"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="comments"
              fill="hsl(217, 91%, 60%)"
              name="comments"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="shares"
              fill="hsl(142, 76%, 36%)"
              name="shares"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}






