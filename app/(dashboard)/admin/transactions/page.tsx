import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TransactionApprovalButton } from "@/components/admin/transaction-approval";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function AdminTransactionsPage() {
  await requireAdmin();

  const transactions = await prisma.transaction.findMany({
    where: {
      status: "PENDING",
      type: {
        in: ["DEPOSIT", "WITHDRAWAL"],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const recentTransactions = await prisma.transaction.findMany({
    where: {
      status: {
        in: ["COMPLETED", "REJECTED"],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">İşlem Yönetimi</h2>
        <p className="text-muted-foreground">
          Bekleyen işlemleri inceleyin ve onaylayın
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bekleyen İşlemler ({transactions.length})</CardTitle>
          <CardDescription>
            Onay bekleyen yatırma ve çekme işlemleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Bekleyen işlem yok
            </p>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            transaction.type === "DEPOSIT" ? "success" : "warning"
                          }
                        >
                          {transaction.type === "DEPOSIT" && "YATIRMA"}
                          {transaction.type === "WITHDRAWAL" && "ÇEKME"}
                          {transaction.type === "EARNING" && "KAZANÇ"}
                          {transaction.type === "SPEND" && "HARCAMA"}
                        </Badge>
                        <span className="font-semibold text-lg">
                          {formatCurrency(Number(transaction.amount))}
                        </span>
                      </div>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Kullanıcı:</span>{" "}
                        <span className="font-medium">{transaction.user.name}</span> (
                        {transaction.user.email})
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Rol:</span>{" "}
                        <span className="capitalize">{transaction.user.role.toLowerCase()}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(transaction.createdAt)}
                      </p>
                    </div>
                  </div>

                  {transaction.description && (
                    <p className="text-sm text-muted-foreground">
                      {transaction.description}
                    </p>
                  )}

                  {transaction.reference && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Referans:</span>{" "}
                      <span className="font-mono">{transaction.reference}</span>
                    </p>
                  )}

                  {transaction.bankDetails && (
                    <div className="text-sm space-y-1 bg-muted/50 p-3 rounded">
                      <p className="font-semibold">Banka Detayları:</p>
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(JSON.parse(transaction.bankDetails), null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <TransactionApprovalButton
                      transactionId={transaction.id}
                      action="approve"
                    />
                    <TransactionApprovalButton
                      transactionId={transaction.id}
                      action="reject"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Son İşlemler</CardTitle>
          <CardDescription>
            Yakın zamanda işlenen işlemler
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Son işlem yok
            </p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          transaction.status === "COMPLETED"
                            ? "success"
                            : "destructive"
                        }
                      >
                        {transaction.status === "COMPLETED" && "TAMAMLANDI"}
                        {transaction.status === "REJECTED" && "REDDEDİLDİ"}
                        {transaction.status === "PENDING" && "BEKLEMEDE"}
                      </Badge>
                      <span className="font-medium">{transaction.type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {transaction.user.name} • {formatDateTime(transaction.createdAt)}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(Number(transaction.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


