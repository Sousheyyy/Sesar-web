"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { UserRole } from "@prisma/client";

interface RoleData {
  role: UserRole;
  count: number;
  label: string;
}

interface UserRoleDistributionProps {
  data: RoleData[];
  title?: string;
  description?: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  CREATOR: "hsl(217, 91%, 60%)", // blue
  ARTIST: "hsl(142, 76%, 36%)", // green
  ADMIN: "hsl(38, 92%, 50%)", // yellow
};

const ROLE_LABELS: Record<UserRole, string> = {
  CREATOR: "İçerik Üreticiler",
  ARTIST: "Sanatçılar",
  ADMIN: "Yöneticiler",
};

export function UserRoleDistribution({
  data,
  title = "Kullanıcı Rol Dağılımı",
  description = "Kullanıcıların rol bazında dağılımı",
}: UserRoleDistributionProps) {
  const chartData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      fill: ROLE_COLORS[item.role] || "hsl(var(--muted))",
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <p className="text-sm font-medium">{data.payload.label}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} kullanıcı
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

    if (percent < 0.05) return null;

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
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Henüz kullanıcı yok
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






