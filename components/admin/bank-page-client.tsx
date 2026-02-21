"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MetricCard } from "@/components/analytics/metric-card";
import { RevenuePayoutsComparison } from "@/components/analytics/revenue-payouts-comparison";
import { DatePicker } from "@/components/ui/new-date-picker";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import {
  Landmark,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  ArrowUpFromLine,
  Clock,
  RotateCcw,
  CheckCircle,
  Wallet,
  DollarSign,
  PieChart as PieChartIcon,
  CalendarDays,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// --- Types ---

type KPIs = {
  platformRevenue: number;
  totalCampaignBudgets: number;
  totalNetPrizePool: number;
  campaignCount: number;
  totalCreatorEarnings: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  pendingWithdrawalsAmount: number;
  pendingWithdrawalsCount: number;
  totalRefunds: number;
  totalCreatorBalance: number;
  creatorWalletCount: number;
  totalArtistBalance: number;
  artistWalletCount: number;
  totalCompletedCampaigns: number;
  insuranceTriggeredCount: number;
  insuranceRate: number;
};

type MonthlyRevenue = {
  month: string;
  totalBudget: number;
  commission: number;
  campaigns: number;
};

type RevenueVsPayouts = {
  date: string;
  revenue: number;
  payouts: number;
};

type BudgetBreakdownItem = {
  name: string;
  value: number;
  fill: string;
};

type TopWallet = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  balance: number;
  avatar: string | null;
};

type RecentCampaignPayout = {
  id: string;
  title: string;
  totalBudget: number;
  commissionPercent: number;
  submissionCount: number;
  totalDistributed: number;
  insuranceTriggered: boolean;
  completedAt: string;
};

interface BankPageClientProps {
  kpis: KPIs;
  monthlyRevenueData: MonthlyRevenue[];
  revenueVsPayoutsData: RevenueVsPayouts[];
  budgetBreakdown: BudgetBreakdownItem[];
  topWallets: TopWallet[];
  recentCampaignPayouts: RecentCampaignPayout[];
  useMockData?: boolean;
}

// --- Role labels ---

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Yönetici",
  ARTIST: "Sanatçı",
  CREATOR: "Creator",
};

// --- Component ---

export function BankPageClient({
  kpis,
  monthlyRevenueData,
  revenueVsPayoutsData,
  budgetBreakdown,
  topWallets,
  recentCampaignPayouts,
  useMockData,
}: BankPageClientProps) {
  const totalWalletLiability = kpis.totalCreatorBalance + kpis.totalArtistBalance;

  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStartDate = searchParams?.get("startDate") ?? null;
  const currentEndDate = searchParams?.get("endDate") ?? null;

  const [startDate, setStartDate] = useState<Date | undefined>(
    currentStartDate ? new Date(currentStartDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    currentEndDate ? new Date(currentEndDate) : undefined
  );

  const hasDateFilter = !!currentStartDate || !!currentEndDate;

  const applyDateFilter = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate.toISOString().split("T")[0]);
    if (endDate) params.set("endDate", endDate.toISOString().split("T")[0]);
    router.push(`/admin/bank${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    router.push("/admin/bank");
  };

  return (
    <div className="space-y-6">
      {/* ─── Mock Data Banner ──────────────────────────────────────── */}
      {useMockData && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">
              Simülasyon Modu
            </p>
            <p className="text-xs text-amber-400/80">
              Henüz gerçek veri bulunmadığı için örnek veriler gösterilmektedir. Kampanyalar oluşturuldukça gerçek veriler burada görünecektir.
            </p>
          </div>
        </div>
      )}

      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 mb-2">
            <Landmark className="w-3 h-3" />
            <span>Finansal Yönetim</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Banka</h2>
          <p className="text-zinc-400 mt-1">
            Platform finansal durumu ve gelir analizi
          </p>
        </div>

        {/* ─── Date Filter ─────────────────────────────────────── */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Başlangıç</label>
            <div className="w-[180px]">
              <DatePicker
                date={startDate}
                setDate={setStartDate}
                placeholder="Başlangıç tarihi"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Bitiş</label>
            <div className="w-[180px]">
              <DatePicker
                date={endDate}
                setDate={setEndDate}
                placeholder="Bitiş tarihi"
              />
            </div>
          </div>
          <Button
            onClick={applyDateFilter}
            size="sm"
            disabled={!startDate && !endDate}
            className="h-10"
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Uygula
          </Button>
          {hasDateFilter && (
            <Button
              onClick={clearDateFilter}
              variant="ghost"
              size="sm"
              className="h-10 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Temizle
            </Button>
          )}
        </div>
      </div>

      {/* ─── Primary KPI Cards (4) ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Platform Geliri"
          value={formatCurrency(kpis.platformRevenue)}
          description={`${kpis.campaignCount} kampanyadan`}
          icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
          variant="success"
        />
        <MetricCard
          title="Toplam Bütçe"
          value={formatCurrency(kpis.totalCampaignBudgets)}
          description={`Ödül havuzu: ${formatCurrency(kpis.totalNetPrizePool)}`}
          icon={<PieChartIcon className="h-4 w-4 text-purple-400" />}
          variant="primary"
        />
        <MetricCard
          title="Creator Kazançları"
          value={formatCurrency(kpis.totalCreatorEarnings)}
          description="Dağıtılan toplam kazanç"
          icon={<TrendingUp className="h-4 w-4 text-blue-400" />}
          variant="default"
        />
        <MetricCard
          title="Cüzdan Yükümlülüğü"
          value={formatCurrency(totalWalletLiability)}
          description={`${kpis.creatorWalletCount + kpis.artistWalletCount} aktif cüzdan`}
          icon={<Wallet className="h-4 w-4 text-yellow-400" />}
          variant="warning"
        />
      </div>

      {/* ─── Revenue Flow Breakdown ────────────────────────────────── */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-lg font-medium text-white">
              Gelir Akışı
            </CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Kampanya bütçelerinin dağılım akışı
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            {/* Budget In */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">
                İşlenen Bütçe
              </p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(kpis.totalCampaignBudgets)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {kpis.campaignCount} kampanya
              </p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-zinc-600" />
            </div>

            {/* Commission */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">
                Komisyon (%20)
              </p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(kpis.platformRevenue)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {kpis.totalCampaignBudgets > 0
                  ? `%${((kpis.platformRevenue / kpis.totalCampaignBudgets) * 100).toFixed(1)}`
                  : "%0"}{" "}
                oranı
              </p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-zinc-600" />
            </div>

            {/* Distributed */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">
                Dağıtılan Kazanç
              </p>
              <p className="text-xl font-bold text-blue-400">
                {formatCurrency(kpis.totalCreatorEarnings)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Ödül havuzunun{" "}
                {kpis.totalNetPrizePool > 0
                  ? `%${((kpis.totalCreatorEarnings / kpis.totalNetPrizePool) * 100).toFixed(1)}`
                  : "%0"}
                &apos;i
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Monthly Revenue Chart ─────────────────────────────────── */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-lg font-medium text-white">
              Aylık Gelir Trendi
            </CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Aylık kampanya bütçeleri ve komisyon geliri
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <MonthlyRevenueChart data={monthlyRevenueData} />
        </CardContent>
      </Card>

      {/* ─── Revenue vs Payouts ────────────────────────────────────── */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-lg font-medium text-white">
              Gelir vs Ödemeler
            </CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Komisyon geliri ve creator kazanç dağıtımı karşılaştırması
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <RevenuePayoutsComparison data={revenueVsPayoutsData} />
        </CardContent>
      </Card>

      {/* ─── Secondary KPI Cards (5) ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Toplam Çekimler"
          value={formatCurrency(kpis.totalWithdrawals)}
          description={`${kpis.withdrawalCount} çekim`}
          icon={<ArrowUpFromLine className="h-4 w-4 text-red-400" />}
          variant="destructive"
        />
        <MetricCard
          title="Bekleyen Çekimler"
          value={formatCurrency(kpis.pendingWithdrawalsAmount)}
          description={`${kpis.pendingWithdrawalsCount} bekleyen`}
          icon={<Clock className="h-4 w-4 text-yellow-400" />}
          variant="warning"
        />
        <MetricCard
          title="Toplam İadeler"
          value={formatCurrency(kpis.totalRefunds)}
          description="Sigorta iadeleri"
          icon={<RotateCcw className="h-4 w-4 text-orange-400" />}
          variant="default"
        />
        <MetricCard
          title="Sigorta Oranı"
          value={`%${kpis.insuranceRate.toFixed(1)}`}
          description={`${kpis.insuranceTriggeredCount}/${kpis.totalCompletedCampaigns} kampanya`}
          icon={<ShieldCheck className="h-4 w-4 text-purple-400" />}
          variant="primary"
        />
        <MetricCard
          title="Tamamlanan Kampanya"
          value={kpis.totalCompletedCampaigns}
          description="Başarıyla tamamlandı"
          icon={<CheckCircle className="h-4 w-4 text-green-400" />}
          variant="success"
        />
      </div>

      {/* ─── Budget Distribution + Top Wallets ─────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Budget Distribution Donut */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-400" />
              <CardTitle className="text-lg font-medium text-white">
                Bütçe Dağılımı
              </CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Toplam kampanya bütçelerinin nereye gittiği
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetDistributionChart
              data={budgetBreakdown}
              total={kpis.totalCampaignBudgets}
            />
          </CardContent>
        </Card>

        {/* Top Wallets */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-yellow-400" />
              <CardTitle className="text-lg font-medium text-white">
                En Yüksek Bakiyeler
              </CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              En yüksek bakiyeye sahip kullanıcılar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topWallets.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">
                Henüz veri yok
              </p>
            ) : (
              topWallets.map((user, idx) => {
                const initials = (user.name || user.email)
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs font-bold text-zinc-500 w-5 text-center">
                      {idx + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user.avatar || undefined}
                        alt={user.name || "User"}
                      />
                      <AvatarFallback className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {user.name || user.email}
                      </p>
                      <Badge
                        variant={
                          user.role === "ADMIN"
                            ? "default"
                            : user.role === "ARTIST"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </div>
                    <span className="font-semibold text-sm text-emerald-400 shrink-0">
                      {formatCurrency(user.balance)}
                    </span>
                  </div>
                );
              })
            )}
            {topWallets.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Creator Bakiyesi</span>
                  <span className="text-zinc-300">
                    {formatCurrency(kpis.totalCreatorBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                  <span>Sanatçı Bakiyesi</span>
                  <span className="text-zinc-300">
                    {formatCurrency(kpis.totalArtistBalance)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Recent Completed Campaign Payouts ─────────────────────── */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <CardTitle className="text-lg font-medium text-white">
              Son Kampanya Ödemeleri
            </CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            En son tamamlanan kampanyaların ödeme detayları
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5">
                  <TableHead className="font-semibold text-zinc-400">
                    Kampanya
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-400">
                    Bütçe
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-400">
                    Komisyon
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-400">
                    Dağıtılan
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-400">
                    Katılımcı
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-400">
                    Sigorta
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-400">
                    Tarih
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaignPayouts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-zinc-500 py-8"
                    >
                      Henüz tamamlanan kampanya yok
                    </TableCell>
                  </TableRow>
                ) : (
                  recentCampaignPayouts.map((c) => {
                    const commissionAmount =
                      (c.totalBudget * c.commissionPercent) / 100;
                    return (
                      <TableRow
                        key={c.id}
                        className={cn(
                          "border-white/5",
                          c.insuranceTriggered && "bg-amber-500/5"
                        )}
                      >
                        <TableCell className="font-medium text-white text-sm max-w-[200px] truncate">
                          {c.title}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-300">
                          {formatCurrency(c.totalBudget)}
                        </TableCell>
                        <TableCell className="text-sm text-emerald-400">
                          {formatCurrency(commissionAmount)}
                        </TableCell>
                        <TableCell className="text-sm text-blue-400 font-medium">
                          {formatCurrency(c.totalDistributed)}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-300">
                          {c.submissionCount}
                        </TableCell>
                        <TableCell>
                          {c.insuranceTriggered ? (
                            <Badge
                              variant="warning"
                              className="text-[10px]"
                            >
                              Tetiklendi
                            </Badge>
                          ) : (
                            <Badge
                              variant="success"
                              className="text-[10px]"
                            >
                              Normal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-400">
                          {formatDateTime(c.completedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Inline Chart: Monthly Revenue ────────────────────────────────

function MonthlyRevenueChart({ data }: { data: MonthlyRevenue[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-zinc-500">
        Henüz veri yok
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as MonthlyRevenue;
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl min-w-[220px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-700">
            <p className="text-sm font-medium text-white">{d.month}</p>
            <span className="text-xs bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">
              {d.campaigns} kampanya
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6]" />
                <span className="text-sm text-zinc-300">Toplam Bütçe</span>
              </div>
              <span className="text-sm font-semibold text-white">
                {formatCurrency(d.totalBudget)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" />
                <span className="text-sm text-zinc-300">Komisyon</span>
              </div>
              <span className="text-sm font-semibold text-emerald-400">
                {formatCurrency(d.commission)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => {
            if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
            return `₺${value}`;
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              totalBudget: "Toplam Bütçe",
              commission: "Komisyon Geliri",
            };
            return labels[value] || value;
          }}
          wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
        />
        <Bar
          dataKey="totalBudget"
          fill="#8b5cf6"
          name="totalBudget"
          radius={[4, 4, 0, 0]}
          barSize={28}
        />
        <Bar
          dataKey="commission"
          fill="#22c55e"
          name="commission"
          radius={[4, 4, 0, 0]}
          barSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Inline Chart: Budget Distribution Donut ──────────────────────

function BudgetDistributionChart({
  data,
  total,
}: {
  data: BudgetBreakdownItem[];
  total: number;
}) {
  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500">
        Henüz veri yok
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0];
      const percent = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: d.payload.fill }}
            />
            <p className="text-sm font-medium text-white">{d.name}</p>
          </div>
          <p className="text-sm text-zinc-300">
            {formatCurrency(d.value)}{" "}
            <span className="text-zinc-500">(%{percent})</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="relative">
        <ResponsiveContainer width={260} height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
              stroke="#09090b"
              strokeWidth={2}
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-zinc-500">Toplam</p>
            <p className="text-lg font-bold text-white">
              {formatCurrency(total)}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-3 flex-1">
        {data.map((item) => {
          const percent =
            total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
          return (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="text-sm text-zinc-300">{item.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-white">
                  {formatCurrency(item.value)}
                </span>
                <span className="text-xs text-zinc-500 ml-2">%{percent}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
