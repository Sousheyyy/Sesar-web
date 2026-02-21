import { requireArtist } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/analytics/metric-card";
import { TLIcon } from "@/components/icons/tl-icon";
import { WalletActions } from "@/components/wallet/wallet-actions";
import { WalletPagination } from "@/components/wallet/wallet-pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  TrendingUp,
  Receipt,
  CreditCard,
} from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 20;

const typeConfig: Record<string, { label: string; color: string; icon: typeof ArrowDownCircle }> = {
  DEPOSIT: { label: "Para Yatırma", color: "text-green-400", icon: ArrowDownCircle },
  WITHDRAWAL: { label: "Para Çekme", color: "text-red-400", icon: ArrowUpCircle },
  EARNING: { label: "Kazanç", color: "text-green-400", icon: TrendingUp },
  SPEND: { label: "Harcama", color: "text-orange-400", icon: Receipt },
  REFUND: { label: "İade", color: "text-blue-400", icon: ArrowDownCircle },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  PENDING: { label: "Beklemede", variant: "warning" },
  COMPLETED: { label: "Tamamlandı", variant: "success" },
  REJECTED: { label: "Reddedildi", variant: "destructive" },
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireArtist();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1"));

  // Parallelize independent queries for performance
  const [userData, transactions, totalTransactions, activeCampaigns, pendingAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { balance: true },
    }),

    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),

    prisma.transaction.count({
      where: { userId: user.id },
    }),

    prisma.campaign.findMany({
      where: {
        artistId: user.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
        title: true,
        totalBudget: true,
        remainingBudget: true,
      },
    }),

    prisma.transaction.aggregate({
      where: { userId: user.id, status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const balance = Number(userData?.balance ?? 0);
  const activeBudgetTotal = activeCampaigns.reduce(
    (sum, c) => sum + Number(c.totalBudget),
    0
  );
  const pendingTotal = Number(pendingAgg._sum.amount ?? 0);
  const pendingCount = pendingAgg._count;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / ITEMS_PER_PAGE));

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-8 w-8 text-purple-400" />
            Cüzdan
          </h2>
          <p className="text-muted-foreground mt-1">
            Bakiyenizi, işlemlerinizi ve bütçelerinizi takip edin
          </p>
        </div>
        <WalletActions />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Mevcut Bakiye"
          value={formatCurrency(balance)}
          description="Kullanılabilir tutar"
          icon={<TLIcon className="h-4 w-4" />}
          variant="premium"
        />
        <MetricCard
          title="Aktif Bütçe"
          value={formatCurrency(activeBudgetTotal)}
          description={`${activeCampaigns.length} aktif kampanya`}
          icon={<CreditCard className="h-4 w-4" />}
          variant="primary"
        />
        <MetricCard
          title="Bekleyen İşlemler"
          value={formatCurrency(pendingTotal)}
          description={`${pendingCount} bekleyen işlem`}
          icon={<Clock className="h-4 w-4" />}
          variant={pendingCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Transaction History — Left 2/3 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-purple-400" />
                İşlem Geçmişi
              </CardTitle>
              <CardDescription>
                {totalTransactions > 0
                  ? `${totalTransactions} işlem · Sayfa ${page} / ${totalPages}`
                  : "Henüz işlem yok"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 font-medium">Henüz işlem yok</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    İlk işleminiz burada görünecektir
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const type = typeConfig[tx.type] ?? {
                      label: tx.type,
                      color: "text-zinc-400",
                      icon: Receipt,
                    };
                    const status = statusConfig[tx.status] ?? {
                      label: tx.status,
                      variant: "secondary" as const,
                    };
                    const TxIcon = type.icon;
                    const isIncoming = tx.type === "DEPOSIT" || tx.type === "EARNING" || tx.type === "REFUND";

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className={`rounded-full p-2 bg-white/5 ${type.color}`}>
                          <TxIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {type.label}
                            </p>
                            <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                              {status.label}
                            </Badge>
                          </div>
                          {tx.description && (
                            <p className="text-xs text-zinc-500 truncate mt-0.5">
                              {tx.description}
                            </p>
                          )}
                          <p className="text-xs text-zinc-600 mt-0.5">
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                        <p className={`font-semibold text-sm whitespace-nowrap ${isIncoming ? "text-green-400" : "text-red-400"}`}>
                          {isIncoming ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                        </p>
                      </div>
                    );
                  })}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <WalletPagination
                      currentPage={page}
                      totalPages={totalPages}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Campaign Budgets — Right 1/3 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-400" />
                Aktif Kampanya Bütçeleri
              </CardTitle>
              <CardDescription>Kampanyalarınızdaki bütçe durumu</CardDescription>
            </CardHeader>
            <CardContent>
              {activeCampaigns.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 font-medium text-sm">Aktif kampanya yok</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCampaigns.map((campaign) => {
                    const total = Number(campaign.totalBudget);
                    const remaining = Number(campaign.remainingBudget);
                    const spent = total - remaining;
                    const percentage = total > 0 ? Math.round((spent / total) * 100) : 0;

                    return (
                      <div key={campaign.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate max-w-[180px]">
                            {campaign.title}
                          </p>
                          <span className="text-xs text-zinc-500">
                            {percentage}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>Harcanan: {formatCurrency(spent)}</span>
                          <span>Kalan: {formatCurrency(remaining)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
