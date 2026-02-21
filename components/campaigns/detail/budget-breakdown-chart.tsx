"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface BudgetSegment {
  name: string;
  value: number;
  color: string;
}

interface BudgetBreakdownChartProps {
  segments: BudgetSegment[];
  totalBudget: number;
  creatorPool: number;
}

export function BudgetBreakdownChart({ segments, totalBudget, creatorPool }: BudgetBreakdownChartProps) {
  const validSegments = segments.filter(s => s.value > 0);

  if (validSegments.length === 0) {
    return (
      <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Bütçe Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-zinc-500">
            Henüz veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/10 bg-zinc-900/95 p-2.5 shadow-xl">
          <p className="text-xs text-zinc-400">{payload[0].name}</p>
          <p className="text-sm font-bold text-white">{formatCurrency(payload[0].value)}</p>
          <p className="text-xs text-zinc-500">
            %{((payload[0].value / totalBudget) * 100).toFixed(1)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Bütçe Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={validSegments}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {validSegments.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs text-zinc-500">Toplam</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalBudget)}</p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 space-y-2">
          {validSegments.map((segment, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="text-zinc-400">{segment.name}</span>
              </div>
              <span className="font-medium text-white">{formatCurrency(segment.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
