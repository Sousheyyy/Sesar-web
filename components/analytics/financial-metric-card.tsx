"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionDetailsModal } from "./transaction-details-modal";
import { formatCurrency, cn } from "@/lib/utils";

interface FinancialMetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "premium";
  onClick?: () => void;
  modalTitle: string;
  modalType: "revenue" | "payouts" | "platformFee" | "safetyReserve" | "totalBank";
  totalAmount: number;
  className?: string; // Add className
}

export function FinancialMetricCard({
  title,
  value,
  description,
  icon,
  variant = "default",
  modalTitle,
  modalType,
  totalAmount,
  className,
}: FinancialMetricCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsModalOpen(true);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/transactions?type=${modalType}`);
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const variantStyles = {
    default: "",
    primary: "border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors",
    success: "border-green-500/20 bg-green-500/5 cursor-pointer hover:bg-green-500/10 transition-colors",
    warning: "border-yellow-500/20 bg-yellow-500/5 cursor-pointer hover:bg-yellow-500/10 transition-colors",
    destructive: "border-red-500/20 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-colors",
    premium: "border-purple-500/20 bg-purple-500/5 cursor-pointer hover:bg-purple-500/10 transition-colors",
  };

  return (
    <>
      <Card
        className={cn(variantStyles[variant], className)}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>

      <TransactionDetailsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={modalTitle}
        totalAmount={totalAmount}
        transactions={transactions}
        type={modalType}
        isLoading={isLoading}
      />
    </>
  );
}

