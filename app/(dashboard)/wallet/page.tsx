import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowDownCircle, ArrowUpCircle, Clock } from "lucide-react";
import { TLIcon } from "@/components/icons/tl-icon";
import Link from "next/link";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const user = await requireAuth();

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { balance: true },
  });

  // Fetch transaction list (limited for UI)
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  // Fetch real counts from DB
  const [totalCount, pendingCount] = await Promise.all([
    prisma.transaction.count({
      where: { userId: user.id }
    }),
    prisma.transaction.count({
      where: { userId: user.id, status: "PENDING" }
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cüzdan</h2>
          <p className="text-muted-foreground">
            Bakiyenizi ve işlemlerinizi yönetin
          </p>
        </div>
        <div className="flex gap-2">
          {user.role === UserRole.ARTIST && (
            <Link href="/wallet/deposit">
              <Button className="gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                Para Yatır
              </Button>
            </Link>
          )}
          {user.role === UserRole.CREATOR && (
            <Link href="/wallet/withdraw">
              <Button className="gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Para Çek
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kullanılabilir Bakiye</CardTitle>
            <TLIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(Number(userData?.balance || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {user.role === UserRole.ARTIST ? "Harcamaya" : "Çekmeye"} hazır
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen İşlemler</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Yönetici onayı bekleniyor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam İşlem</CardTitle>
            <TLIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              Tüm zamanlar
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>İşlem Geçmişi</CardTitle>
          <CardDescription>
            Son işlemler ve durumları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Henüz işlem yok
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-full p-2 ${transaction.type === "DEPOSIT" || transaction.type === "EARNING"
                        ? "bg-green-100"
                        : "bg-red-100"
                        }`}
                    >
                      {transaction.type === "DEPOSIT" || transaction.type === "EARNING" ? (
                        <ArrowDownCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.type}</p>
                      {transaction.description && (
                        <p className="text-sm text-muted-foreground">
                          {transaction.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(transaction.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${transaction.type === "DEPOSIT" || transaction.type === "EARNING"
                        ? "text-green-600"
                        : "text-red-600"
                        }`}
                    >
                      {transaction.type === "DEPOSIT" || transaction.type === "EARNING"
                        ? "+"
                        : "-"}
                      {formatCurrency(Number(transaction.amount))}
                    </p>
                    <Badge
                      variant={
                        transaction.status === "COMPLETED"
                          ? "success"
                          : transaction.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {transaction.status === "PENDING" && "BEKLEMEDE"}
                      {transaction.status === "COMPLETED" && "TAMAMLANDI"}
                      {transaction.status === "REJECTED" && "REDDEDİLDİ"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


