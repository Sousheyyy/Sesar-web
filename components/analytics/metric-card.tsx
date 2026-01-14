"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/analytics-utils";
import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    percentageChange: number;
    isPositive: boolean;
  } | string; // Support string for simple trends like "+5%" or formatted strings
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "premium"; // Added premium variant
  className?: string;
}

const variantStyles = {
  default: "bg-white/5 border-white/10 backdrop-blur-md",
  primary: "bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20 backdrop-blur-md",
  success: "bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20 backdrop-blur-md",
  warning: "bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20 backdrop-blur-md",
  destructive: "bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20 backdrop-blur-md",
  premium: "bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl shadow-xl",
};

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  variant = "default",
  className,
}: MetricCardProps) {
  // Helper to parse trend if it's an object or string
  const renderTrend = () => {
    if (!trend) return null;

    // Handle string trends (e.g. "+12%" or "Stable")
    if (typeof trend === 'string') {
      const isPositive = trend.includes('+') || trend.toLowerCase().includes('up') || trend.toLowerCase().includes('artış');
      const isNegative = trend.includes('-') || trend.toLowerCase().includes('down') || trend.toLowerCase().includes('düşüş');

      return (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            isPositive ? "text-green-400" : isNegative ? "text-red-400" : "text-zinc-400"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : isNegative ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {trend}
        </div>
      )
    }

    // Handle object trends
    return (
      <div
        className={cn(
          "flex items-center gap-1 text-xs font-medium",
          trend.isPositive ? "text-green-400" : "text-red-400"
        )}
      >
        {trend.isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {formatPercentage(trend.percentageChange)}
      </div>
    );
  };

  return (
    <Card className={cn(variantStyles[variant], "transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/5", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        {(description || trend) && (
          <div className="flex items-center justify-between mt-1">
            {description && (
              <p className="text-xs text-zinc-500 line-clamp-1">{description}</p>
            )}
            {!description && <div className="flex-1" />} {/* Spacer if no description */}
            <div className="shrink-0 ml-2">
              {renderTrend()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
