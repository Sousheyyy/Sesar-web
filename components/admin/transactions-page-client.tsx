"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/new-date-picker";
import { TransactionApprovalButton } from "@/components/admin/transaction-approval";
import { PaginationControl } from "@/components/ui/pagination-control";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import {
  TransactionType,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import {
  Search,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  Clock,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Eye,
  LayoutList,
  Users,
  Settings2,
  Loader2,
} from "lucide-react";

// --- Types ---

type TransactionRow = {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string | null;
  reference: string | null;
  notes: string | null;
  bankDetails: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    avatar: string | null;
    tiktokAvatarUrl: string | null;
    tiktokHandle: string | null;
  };
};

type Stats = {
  total: number;
  pending: number;
  completed: number;
  rejected: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalEarnings: number;
  totalSpend: number;
  totalRefunds: number;
};

type CampaignPayout = {
  campaignTitle: string;
  totalPayout: number;
  creatorCount: number;
  creators: { name: string; email: string; amount: number; date: string }[];
  latestDate: string;
};

interface TransactionsPageClientProps {
  stats: Stats;
  typeCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  campaignPayouts: CampaignPayout[];
}

// --- Config Maps ---

const TYPE_CONFIG: Record<
  TransactionType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    activeColor: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  DEPOSIT: {
    label: "Yatırma",
    icon: ArrowDownToLine,
    color: "text-green-500",
    activeColor: "ring-green-500 border-green-500 bg-green-500/5",
    badgeVariant: "success",
  },
  WITHDRAWAL: {
    label: "Çekme",
    icon: ArrowUpFromLine,
    color: "text-red-500",
    activeColor: "ring-red-500 border-red-500 bg-red-500/5",
    badgeVariant: "destructive",
  },
  EARNING: {
    label: "Kazanç",
    icon: TrendingUp,
    color: "text-blue-500",
    activeColor: "ring-blue-500 border-blue-500 bg-blue-500/5",
    badgeVariant: "default",
  },
  SPEND: {
    label: "Harcama",
    icon: ShoppingCart,
    color: "text-orange-500",
    activeColor: "ring-orange-500 border-orange-500 bg-orange-500/5",
    badgeVariant: "warning",
  },
  REFUND: {
    label: "İade",
    icon: RotateCcw,
    color: "text-purple-500",
    activeColor: "ring-purple-500 border-purple-500 bg-purple-500/5",
    badgeVariant: "secondary",
  },
  ADJUSTMENT: {
    label: "Düzenleme",
    icon: Settings2,
    color: "text-cyan-500",
    activeColor: "ring-cyan-500 border-cyan-500 bg-cyan-500/5",
    badgeVariant: "outline",
  },
};

const STATUS_CONFIG: Record<
  TransactionStatus,
  {
    label: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
    color: string;
  }
> = {
  PENDING: { label: "Beklemede", badgeVariant: "warning", color: "text-yellow-500" },
  COMPLETED: { label: "Tamamlandı", badgeVariant: "success", color: "text-green-500" },
  REJECTED: { label: "Reddedildi", badgeVariant: "destructive", color: "text-red-500" },
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Yönetici",
  ARTIST: "Sanatçı",
  CREATOR: "Creator",
};

const INCOME_TYPES: TransactionType[] = ["DEPOSIT", "EARNING", "REFUND"];

// --- Helpers ---

type SortField = "createdAt" | "amount";
type SortDir = "asc" | "desc";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CAMPAIGN_APPROVE: "Kampanya Onayı",
  CAMPAIGN_REJECT: "Kampanya Reddi",
  CAMPAIGN_FINISH: "Kampanya Bitirme",
  CAMPAIGN_PAUSE: "Kampanya Durdurma",
  CAMPAIGN_RESUME: "Kampanya Devam",
  CAMPAIGN_DELETE: "Kampanya Silme",
  TRANSACTION_APPROVE: "İşlem Onayı",
  TRANSACTION_REJECT: "İşlem Reddi",
  USER_BALANCE_ADJUST: "Bakiye Düzenleme",
  USER_ROLE_CHANGE: "Rol Değişikliği",
  USER_DELETE: "Kullanıcı Silme",
  SETTINGS_UPDATE: "Ayar Güncelleme",
  MESSAGE_READ: "Mesaj Okundu",
};

// --- Component ---

export function TransactionsPageClient({
  stats,
  typeCounts,
  statusCounts,
  campaignPayouts,
}: TransactionsPageClientProps) {
  // Filters
  const [typeFilters, setTypeFilters] = useState<TransactionType[]>([]);
  const [statusFilters, setStatusFilters] = useState<TransactionStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Sort
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Transactions data (fetched from API)
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);

  // Campaign payouts
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignSearch, setCampaignSearch] = useState("");

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<{ id: string; adminId: string; adminEmail: string; action: string; targetType: string; targetId: string | null; details: Record<string, unknown> | null; createdAt: string }[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch transactions from server-side API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "250");
      if (typeFilters.length > 0) params.set("type", typeFilters.join(","));
      if (statusFilters.length > 0) params.set("status", statusFilters.join(","));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("dateFrom", dateFrom.toISOString());
      if (dateTo) params.set("dateTo", dateTo.toISOString());
      params.set("sortBy", sortField);
      params.set("sortOrder", sortDir);

      const res = await fetch(`/api/admin/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setTotalPages(data.totalPages);
        setTotalResults(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, typeFilters, statusFilters, debouncedSearch, dateFrom, dateTo, sortField, sortDir]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const fetchAuditLogs = useCallback(async (p: number) => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-log?page=${p}&limit=250`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs);
        setAuditTotalPages(data.totalPages);
        setAuditPage(data.page);
      }
    } finally {
      setAuditLoading(false);
      setAuditLoaded(true);
    }
  }, []);

  // --- Type filter toggle ---
  const toggleType = (type: TransactionType) => {
    setTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setPage(1);
  };

  // --- Status filter toggle ---
  const toggleStatus = (status: TransactionStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    setPage(1);
  };

  // --- Sort handler ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  // --- Campaign payouts filter ---
  const filteredCampaignPayouts = useMemo(() => {
    if (!campaignSearch.trim()) return campaignPayouts;
    const q = campaignSearch.toLowerCase().trim();
    return campaignPayouts.filter((cp) => cp.campaignTitle.toLowerCase().includes(q));
  }, [campaignPayouts, campaignSearch]);

  // --- Sort icon ---
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />;
    return sortDir === "desc" ? (
      <ChevronDown className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ChevronUp className="w-3.5 h-3.5 text-primary" />
    );
  };

  // --- Clear date filters ---
  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">İşlem Yönetimi</h2>
          <p className="text-muted-foreground">
            Tüm platform işlemlerini görüntüleyin ve yönetin
          </p>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam İşlem</CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Yatırma</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {formatCurrency(stats.totalDeposits)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Çekme</CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <ArrowUpFromLine className="h-5 w-5 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {formatCurrency(stats.totalWithdrawals)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Kazanç</CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {formatCurrency(stats.totalEarnings)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions" className="gap-2">
              <LayoutList className="h-4 w-4" />
              Tüm İşlemler
            </TabsTrigger>
            <TabsTrigger value="campaignPayouts" className="gap-2">
              <Users className="h-4 w-4" />
              Kampanya Ödemeleri
              {campaignPayouts.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {campaignPayouts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="auditLog" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Admin İşlemleri
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: All Transactions */}
          <TabsContent value="transactions" className="space-y-4">
            {/* Type Filter Cards */}
            <div className="grid gap-3 grid-cols-3 md:grid-cols-7">
              <Card
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
                  typeFilters.length === 0 &&
                    "ring-2 ring-primary border-primary shadow-md"
                )}
                onClick={() => {
                  setTypeFilters([]);
                  setPage(1);
                }}
              >
                <CardContent className="p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Tümü</p>
                  <p className="text-lg font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((type) => {
                const config = TYPE_CONFIG[type];
                const Icon = config.icon;
                const isActive = typeFilters.includes(type);
                return (
                  <Card
                    key={type}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
                      isActive && `ring-2 ${config.activeColor} shadow-md`
                    )}
                    onClick={() => toggleType(type)}
                  >
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Icon className={cn("h-3.5 w-3.5", config.color)} />
                        <p className="text-xs font-medium text-muted-foreground">
                          {config.label}
                        </p>
                      </div>
                      <p className="text-lg font-bold">{typeCounts[type] || 0}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">Durum:</span>
              {(Object.keys(STATUS_CONFIG) as TransactionStatus[]).map((status) => {
                const config = STATUS_CONFIG[status];
                const isActive = statusFilters.includes(status);
                const count = statusCounts[status] || 0;
                return (
                  <Button
                    key={status}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleStatus(status)}
                    className={cn("gap-1.5", isActive && "shadow-md")}
                  >
                    {config.label}
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center"
                    >
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>

            {/* Main Table Card */}
            <Card className="shadow-lg">
              <CardHeader className="border-b">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl">İşlemler</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {totalResults} işlem gösteriliyor
                      </p>
                    </div>
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Kullanıcı adı, email veya açıklama ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {/* Date Range Filter */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground font-medium">Tarih:</span>
                    <div className="w-48">
                      <DatePicker
                        date={dateFrom}
                        setDate={(d) => {
                          setDateFrom(d);
                          setPage(1);
                        }}
                        placeholder="Başlangıç"
                      />
                    </div>
                    <span className="text-muted-foreground">—</span>
                    <div className="w-48">
                      <DatePicker
                        date={dateTo}
                        setDate={(d) => {
                          setDateTo(d);
                          setPage(1);
                        }}
                        placeholder="Bitiş"
                      />
                    </div>
                    {(dateFrom || dateTo) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearDateFilters}
                        className="text-muted-foreground hover:text-foreground gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        Temizle
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold min-w-[200px]">
                          Kullanıcı
                        </TableHead>
                        <TableHead className="font-semibold min-w-[80px]">Rol</TableHead>
                        <TableHead className="font-semibold min-w-[100px]">Tür</TableHead>
                        <TableHead
                          className="font-semibold min-w-[120px] cursor-pointer select-none hover:text-primary transition-colors"
                          onClick={() => handleSort("amount")}
                        >
                          <span className="flex items-center gap-1">
                            Tutar <SortIcon field="amount" />
                          </span>
                        </TableHead>
                        <TableHead className="font-semibold min-w-[200px]">
                          Açıklama
                        </TableHead>
                        <TableHead
                          className="font-semibold min-w-[160px] cursor-pointer select-none hover:text-primary transition-colors"
                          onClick={() => handleSort("createdAt")}
                        >
                          <span className="flex items-center gap-1">
                            Tarih <SortIcon field="createdAt" />
                          </span>
                        </TableHead>
                        <TableHead className="font-semibold min-w-[100px]">Durum</TableHead>
                        <TableHead className="font-semibold min-w-[100px]">
                          İşlemler
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : transactions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center text-muted-foreground py-12"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <FileText className="h-8 w-8 text-muted-foreground/50" />
                              <p>İşlem bulunamadı</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((t) => {
                          const typeConf = TYPE_CONFIG[t.type];
                          const statusConf = STATUS_CONFIG[t.status];
                          const TypeIcon = typeConf.icon;
                          const avatarUrl =
                            t.user.tiktokAvatarUrl || t.user.avatar || null;
                          const initials = (t.user.name || t.user.email)
                            .slice(0, 2)
                            .toUpperCase();
                          const isIncome = INCOME_TYPES.includes(t.type);
                          const isPending =
                            t.status === "PENDING" &&
                            (t.type === "DEPOSIT" || t.type === "WITHDRAWAL");

                          return (
                            <TableRow
                              key={t.id}
                              className={cn(
                                "cursor-pointer hover:bg-muted/70 active:bg-muted transition-all",
                                t.status === "PENDING" && "bg-yellow-500/5"
                              )}
                              onClick={() => setSelectedTransaction(t)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage
                                      src={avatarUrl || undefined}
                                      alt={t.user.name || "User"}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {t.user.name || "-"}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {t.user.email}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    t.user.role === "ADMIN"
                                      ? "default"
                                      : t.user.role === "ARTIST"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {ROLE_LABELS[t.user.role]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <TypeIcon
                                    className={cn("h-3.5 w-3.5", typeConf.color)}
                                  />
                                  <Badge variant={typeConf.badgeVariant} className="text-xs">
                                    {typeConf.label}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    "font-semibold text-sm",
                                    isIncome ? "text-green-500" : "text-red-500"
                                  )}
                                >
                                  {isIncome ? "+" : "-"}
                                  {formatCurrency(t.amount)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <p
                                  className="text-sm text-muted-foreground truncate max-w-[200px]"
                                  title={t.description || undefined}
                                >
                                  {t.description || "-"}
                                </p>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDateTime(t.createdAt)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusConf.badgeVariant} className="text-xs">
                                  {statusConf.label}
                                </Badge>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {isPending ? (
                                  <div className="flex gap-1">
                                    <TransactionApprovalButton
                                      transactionId={t.id}
                                      action="approve"
                                    />
                                    <TransactionApprovalButton
                                      transactionId={t.id}
                                      action="reject"
                                    />
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-muted-foreground"
                                    onClick={() => setSelectedTransaction(t)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Detay
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="border-t px-4">
                    <PaginationControl
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Campaign Payouts */}
          <TabsContent value="campaignPayouts" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Toplam Kampanya</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <LayoutList className="h-5 w-5 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{campaignPayouts.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Toplam Ödeme</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">
                    {formatCurrency(
                      campaignPayouts.reduce((s, cp) => s + cp.totalPayout, 0)
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Toplam Creator</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {campaignPayouts.reduce((s, cp) => s + cp.creatorCount, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg">
              <CardHeader className="border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Kampanya Ödemeleri</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {filteredCampaignPayouts.length} kampanya gösteriliyor
                    </p>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Kampanya adı ara..."
                      value={campaignSearch}
                      onChange={(e) => setCampaignSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredCampaignPayouts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center gap-2">
                      <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                      <p>Kampanya ödemesi bulunamadı</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredCampaignPayouts.map((cp) => {
                      const isExpanded = expandedCampaign === cp.campaignTitle;
                      return (
                        <div key={cp.campaignTitle}>
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() =>
                              setExpandedCampaign(isExpanded ? null : cp.campaignTitle)
                            }
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className={cn(
                                  "h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 transition-transform duration-200",
                                  isExpanded && "rotate-90"
                                )}
                              >
                                <ChevronRight className="h-4 w-4 text-blue-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {cp.campaignTitle}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(cp.latestDate)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Creator</p>
                                <p className="font-medium text-sm">{cp.creatorCount}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Toplam Ödeme</p>
                                <p className="font-bold text-sm text-green-500">
                                  {formatCurrency(cp.totalPayout)}
                                </p>
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="bg-muted/30 border-t px-4 py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="font-semibold text-xs">Creator</TableHead>
                                    <TableHead className="font-semibold text-xs">Email</TableHead>
                                    <TableHead className="font-semibold text-xs">Tutar</TableHead>
                                    <TableHead className="font-semibold text-xs">Tarih</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cp.creators.map((creator, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-sm font-medium">{creator.name}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{creator.email}</TableCell>
                                      <TableCell className="text-sm font-semibold text-green-500">{formatCurrency(creator.amount)}</TableCell>
                                      <TableCell className="text-sm">{formatDateTime(creator.date)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Admin Audit Log */}
          <TabsContent value="auditLog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Admin İşlem Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                {!auditLoaded && !auditLoading && (
                  <div className="flex justify-center py-8">
                    <Button onClick={() => fetchAuditLogs(1)}>İşlem Geçmişini Yükle</Button>
                  </div>
                )}
                {auditLoading && (
                  <div className="flex justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Yükleniyor...
                  </div>
                )}
                {auditLoaded && auditLogs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">Henüz admin işlem kaydı bulunmuyor.</div>
                )}
                {auditLoaded && auditLogs.length > 0 && (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Admin</TableHead>
                          <TableHead>İşlem</TableHead>
                          <TableHead>Hedef</TableHead>
                          <TableHead>Detay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                            <TableCell className="text-sm">{log.adminEmail}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{AUDIT_ACTION_LABELS[log.action] || log.action}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{log.targetType}{log.targetId ? ` #${log.targetId.slice(0, 8)}` : ""}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{log.details ? JSON.stringify(log.details) : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4">
                      <PaginationControl currentPage={auditPage} totalPages={auditTotalPages} onPageChange={(p) => fetchAuditLogs(p)} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Transaction Detail Dialog */}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={() => setSelectedTransaction(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>İşlem Detayı</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <TransactionDetail
              transaction={selectedTransaction}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Transaction Detail Sub-component ---

function TransactionDetail({ transaction: t }: { transaction: TransactionRow }) {
  const typeConf = TYPE_CONFIG[t.type];
  const statusConf = STATUS_CONFIG[t.status];
  const TypeIcon = typeConf.icon;
  const isIncome = INCOME_TYPES.includes(t.type);
  const avatarUrl = t.user.tiktokAvatarUrl || t.user.avatar || null;
  const initials = (t.user.name || t.user.email).slice(0, 2).toUpperCase();
  const isPending =
    t.status === "PENDING" && (t.type === "DEPOSIT" || t.type === "WITHDRAWAL");

  let bankDetailsObj: Record<string, string> | null = null;
  if (t.bankDetails) {
    try {
      bankDetailsObj = JSON.parse(t.bankDetails);
    } catch {
      // ignore parse errors
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeIcon className={cn("h-5 w-5", typeConf.color)} />
          <Badge variant={typeConf.badgeVariant}>{typeConf.label}</Badge>
        </div>
        <Badge variant={statusConf.badgeVariant}>{statusConf.label}</Badge>
      </div>

      <div className="text-center py-2">
        <p
          className={cn(
            "text-3xl font-bold",
            isIncome ? "text-green-500" : "text-red-500"
          )}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(t.amount)}
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl || undefined} alt={t.user.name || "User"} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm">{t.user.name || "-"}</p>
          <p className="text-xs text-muted-foreground">{t.user.email}</p>
          <Badge
            variant={
              t.user.role === "ADMIN"
                ? "default"
                : t.user.role === "ARTIST"
                  ? "secondary"
                  : "outline"
            }
            className="text-[10px] mt-1"
          >
            {ROLE_LABELS[t.user.role]}
          </Badge>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {t.description && <DetailRow label="Açıklama" value={t.description} />}
        {t.reference && <DetailRow label="Referans" value={t.reference} mono />}
        {t.notes && <DetailRow label="Notlar" value={t.notes} />}
        <DetailRow label="Oluşturulma" value={formatDateTime(t.createdAt)} />
        {t.approvedAt && <DetailRow label="Onaylanma" value={formatDateTime(t.approvedAt)} />}
        {t.approvedBy && <DetailRow label="Onaylayan" value={t.approvedBy} mono />}
      </div>

      {bankDetailsObj && (
        <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Banka Detayları
          </p>
          {Object.entries(bankDetailsObj).map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 pt-2 border-t">
          <TransactionApprovalButton transactionId={t.id} action="approve" />
          <TransactionApprovalButton transactionId={t.id} action="reject" />
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-right break-all",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </span>
    </div>
  );
}
