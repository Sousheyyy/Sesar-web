"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { CampaignStatus } from "@prisma/client";

interface StatusData {
  status: CampaignStatus;
  count: number;
  label: string;
}

interface CampaignStatusChartProps {
  data: StatusData[];
  title?: string;
  description?: string;
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  ACTIVE: "hsl(142, 76%, 36%)", // green
  COMPLETED: "hsl(217, 91%, 60%)", // blue
  PENDING_APPROVAL: "hsl(38, 92%, 50%)", // yellow
  PAUSED: "hsl(215, 16%, 47%)", // gray
  CANCELLED: "hsl(0, 84%, 60%)", // red
  REJECTED: "hsl(0, 72%, 51%)", // dark red
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
  PENDING_APPROVAL: "Onay Bekliyor",
  PAUSED: "Duraklatıldı",
  CANCELLED: "İptal Edildi",
  REJECTED: "Reddedildi",
};

export function CampaignStatusChart({
  data,
  title = "Kampanya Durumu",
  description = "Kampanyaların durum dağılımı",
}: CampaignStatusChartProps) {
  const chartData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      fill: STATUS_COLORS[item.status] || "hsl(var(--muted))",
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <p className="text-sm font-medium">{data.payload.label}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} kampanya
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show label if slice is too small

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Henüz kampanya yok
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
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value, entry: any) => {
                return `${entry.payload.label} (${entry.payload.count})`;
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}






