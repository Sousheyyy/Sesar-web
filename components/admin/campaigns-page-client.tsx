"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Search,
  CheckCircle,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Music2,
  FileText,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { CampaignStatus } from "@prisma/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Campaign = {
  id: string;
  title: string;
  status: CampaignStatus;
  totalBudget: number;
  remainingBudget: number;
  commissionPercent: number;
  durationDays: number;
  createdAt: string;
  startDate: string | null;
  endDate: string | null;
  song: { title: string };
  artist: { id: string; name: string | null; email: string };
  _count: { submissions: number };
};

type Stats = {
  total: number;
  active: number;
  completed: number;
};

type SortField = "totalBudget" | "createdAt" | "submissions" | "endDate";
type SortDir = "asc" | "desc";

const ROWS_PER_PAGE = 250;

interface CampaignsPageClientProps {
  campaigns: Campaign[];
  stats: Stats;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    activeColor: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  ACTIVE: {
    label: "Aktif",
    icon: CheckCircle,
    color: "text-green-500",
    activeColor: "ring-green-500 border-green-500 bg-green-500/5",
    badgeVariant: "default",
  },
  COMPLETED: {
    label: "Tamamlandı",
    icon: CheckCircle,
    color: "text-blue-500",
    activeColor: "ring-blue-500 border-blue-500 bg-blue-500/5",
    badgeVariant: "secondary",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CampaignsPageClient({
  campaigns,
  stats,
}: CampaignsPageClientProps) {
  const [activeFilters, setActiveFilters] = useState<CampaignStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const toggleFilter = (status: CampaignStatus) => {
    setActiveFilters((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const filteredAndSorted = useMemo(() => {
    let result = campaigns;

    // Status filter
    if (activeFilters.length > 0) {
      result = result.filter((c) => activeFilters.includes(c.status));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.song.title.toLowerCase().includes(q) ||
          (c.artist.name && c.artist.name.toLowerCase().includes(q)) ||
          c.artist.email.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case "totalBudget":
          aVal = a.totalBudget;
          bVal = b.totalBudget;
          break;
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case "submissions":
          aVal = a._count.submissions;
          bVal = b._count.submissions;
          break;
        case "endDate":
          aVal = a.endDate ? new Date(a.endDate).getTime() : 0;
          bVal = b.endDate ? new Date(b.endDate).getTime() : 0;
          break;
        default:
          return 0;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [campaigns, activeFilters, searchQuery, sortField, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / ROWS_PER_PAGE)
  );
  const paginatedCampaigns = useMemo(
    () =>
      filteredAndSorted.slice(
        (page - 1) * ROWS_PER_PAGE,
        page * ROWS_PER_PAGE
      ),
    [filteredAndSorted, page]
  );

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors",
        sortField === field
          ? "border-primary bg-primary/10 text-primary"
          : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
      )}
    >
      {children}
      {sortField === field ? (
        sortDir === "desc" ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );

  /* stat boxes config — only show statuses with non-zero counts */
  const filterBoxes: {
    status: CampaignStatus;
    count: number;
  }[] = [
    { status: "ACTIVE", count: stats.active },
    { status: "COMPLETED", count: stats.completed },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Kampanya Yönetimi
        </h2>
        <p className="text-muted-foreground">
          Kampanyaları görüntüleyin ve yönetin
        </p>
      </div>

      {/* Filter Boxes */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {/* "All" box */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
            activeFilters.length === 0 &&
              "ring-2 ring-primary border-primary shadow-md"
          )}
          onClick={() => {
            setActiveFilters([]);
            setPage(1);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-xs font-medium">Tümü</CardTitle>
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center",
                activeFilters.length === 0 ? "bg-primary/20" : "bg-muted"
              )}
            >
              <LayoutGrid
                className={cn(
                  "h-4 w-4",
                  activeFilters.length === 0
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        {filterBoxes.map(({ status, count }) => {
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          const isActive = activeFilters.includes(status);
          return (
            <Card
              key={status}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
                isActive && `ring-2 ${cfg.activeColor} shadow-md`
              )}
              onClick={() => toggleFilter(status)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">
                  {cfg.label}
                </CardTitle>
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    isActive ? "bg-white/10" : "bg-muted"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? cfg.color : "text-muted-foreground"
                    )}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search + Sort Bar */}
      <Card className="shadow-lg">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Kampanyalar</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredAndSorted.length} kampanya gösteriliyor
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kampanya, şarkı veya sanatçı ara..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            {/* Sort buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">
                Sırala:
              </span>
              <SortButton field="createdAt">Tarih</SortButton>
              <SortButton field="totalBudget">Bütçe</SortButton>
              <SortButton field="submissions">Gönderiler</SortButton>
              <SortButton field="endDate">Bitiş</SortButton>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Campaign List */}
          <div className="divide-y">
            {paginatedCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Music2 className="h-8 w-8 opacity-40" />
                <p className="text-sm">Kampanya bulunamadı</p>
              </div>
            ) : (
              paginatedCampaigns.map((campaign) => {
                const commission =
                  (campaign.totalBudget * campaign.commissionPercent) / 100;
                const pool = campaign.totalBudget - commission;
                const cfg = STATUS_CONFIG[campaign.status];

                return (
                  <Link
                    key={campaign.id}
                    href={`/admin/campaigns/${campaign.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/50 active:bg-muted transition-all group">
                      {/* Left section */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">
                            {campaign.title}
                          </p>
                          <Badge
                            variant={cfg.badgeVariant}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          <span className="inline-flex items-center gap-1">
                            <Music2 className="w-3 h-3" />
                            {campaign.song.title}
                          </span>
                          <span className="mx-1.5">&middot;</span>
                          {campaign.artist.name || campaign.artist.email}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(campaign.createdAt)}
                          </span>
                          {campaign.endDate && (
                            <span>
                              Bitiş: {formatDate(campaign.endDate)}
                            </span>
                          )}
                          {!campaign.endDate && (
                            <span>{campaign.durationDays} gün</span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {campaign._count.submissions} gönderi
                          </span>
                        </div>
                      </div>

                      {/* Right section — budget breakdown */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 justify-end text-sm font-mono">
                          <span className="text-green-500 font-semibold" title="Komisyon">
                            {formatCurrency(commission)}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-primary font-semibold" title="Ödül Havuzu">
                            {formatCurrency(pool)}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-foreground font-bold" title="Toplam Bütçe">
                            {formatCurrency(campaign.totalBudget)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide">
                          KOMİSYON / HAVUZ / TOPLAM
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Kalan:{" "}
                          <span className="text-foreground font-medium">
                            {formatCurrency(campaign.remainingBudget)}
                          </span>
                        </p>
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Sayfa {page}/{totalPages} &middot;{" "}
                {filteredAndSorted.length} kampanya
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from(
                  { length: Math.min(totalPages, 5) },
                  (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-9"
                      >
                        {pageNum}
                      </Button>
                    );
                  }
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
