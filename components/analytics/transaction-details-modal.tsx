"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TransactionType, TransactionStatus } from "@prisma/client";

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number | string;
  status: TransactionStatus;
  description: string | null;
  createdAt: Date | string;
  user?: {
    name: string | null;
    email: string;
  } | null;
}

interface TransactionDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  totalAmount: number;
  transactions: Transaction[];
  type: "revenue" | "payouts" | "platformFee" | "safetyReserve" | "totalBank";
  isLoading?: boolean;
}

const TYPE_LABELS = {
  revenue: "Gelir",
  payouts: "Ödemeler",
  platformFee: "Platform Ücreti",
  safetyReserve: "Güvenlik Rezervi",
  totalBank: "Toplam Banka",
};

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: "Yatırma",
  WITHDRAWAL: "Çekme",
  EARNING: "Kazanç",
  SPEND: "Harcama",
  REFUND: "İade",
  ADJUSTMENT: "Düzenleme",
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: "Beklemede",
  COMPLETED: "Tamamlandı",
  REJECTED: "Reddedildi",
};

const STATUS_VARIANTS: Record<TransactionStatus, "default" | "success" | "destructive"> = {
  PENDING: "default",
  COMPLETED: "success",
  REJECTED: "destructive",
};

export function TransactionDetailsModal({
  open,
  onOpenChange,
  title,
  totalAmount,
  transactions,
  type,
  isLoading = false,
}: TransactionDetailsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {TYPE_LABELS[type]} detayları - Toplam: {formatCurrency(totalAmount)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Toplam Tutar</span>
              <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {type === "totalBank" ? `${transactions.length} kullanıcı` : `${transactions.length} işlem`}
            </div>
          </div>

          <div className="h-[400px] overflow-y-auto rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full p-8 text-sm text-muted-foreground">
                Yükleniyor...
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex items-center justify-center h-full p-8 text-sm text-muted-foreground">
                {type === "totalBank" ? "Henüz bakiye bulunmuyor" : "Henüz işlem bulunmuyor"}
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[transaction.status]}>
                          {STATUS_LABELS[transaction.status]}
                        </Badge>
                        <span className="text-sm font-medium">
                          {type === "totalBank" ? "Bakiye" : TRANSACTION_TYPE_LABELS[transaction.type]}
                        </span>
                      </div>
                      {transaction.description && (
                        <p className="text-sm text-muted-foreground">
                          {transaction.description}
                        </p>
                      )}
                      {transaction.user && (
                        <p className="text-xs text-muted-foreground">
                          {transaction.user.name || transaction.user.email}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(transaction.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatCurrency(typeof transaction.amount === "number" ? transaction.amount : Number(transaction.amount) || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

