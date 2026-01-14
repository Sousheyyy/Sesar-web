"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Loader2, Clock, User, Globe, Activity, X, Filter } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { UserRole } from "@prisma/client";

interface ApiCallDetail {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number | null;
  duration: number | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
  } | null;
}

interface ApiCallsDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  limit?: number;
}

const STATUS_COLORS: Record<number, string> = {
  200: "bg-green-500/10 text-green-700 dark:text-green-400",
  201: "bg-green-500/10 text-green-700 dark:text-green-400",
  204: "bg-green-500/10 text-green-700 dark:text-green-400",
  400: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  401: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  403: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  404: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  500: "bg-red-500/10 text-red-700 dark:text-red-400",
  502: "bg-red-500/10 text-red-700 dark:text-red-400",
  503: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  POST: "bg-green-500/10 text-green-700 dark:text-green-400",
  PUT: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  PATCH: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  DELETE: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function ApiCallsDetailsModal({
  open,
  onOpenChange,
  date,
  limit = 50,
}: ApiCallsDetailsModalProps) {
  const [apiCalls, setApiCalls] = useState<ApiCallDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [filters, setFilters] = useState({
    method: "",
    username: "",
  });

  useEffect(() => {
    if (open && date) {
      fetchApiCallDetails();
    } else {
      // Reset when modal closes
      setApiCalls([]);
      setPage(1);
      setError(null);
      setFilters({ method: "", username: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, page, filters.method, filters.username]);

  const fetchApiCallDetails = async () => {
    if (!date) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build query params with filters
      const params = new URLSearchParams({
        date,
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (filters.method) {
        params.set("method", filters.method);
      }
      
      if (filters.username) {
        params.set("username", filters.username);
      }

      const response = await fetch(
        `/api/admin/analytics/api-calls/details?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch API call details");
      }

      const result = await response.json();
      setApiCalls(result.data || []);
      setPagination(result.pagination || pagination);
    } catch (err: any) {
      console.error("Error fetching API call details:", err);
      setError(err.message || "Failed to load API call details");
      setApiCalls([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: "method" | "username", value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  };

  const clearFilters = () => {
    setFilters({ method: "", username: "" });
    setPage(1);
  };

  const hasActiveFilters = filters.method || filters.username;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const getStatusColor = (statusCode: number | null) => {
    if (!statusCode) return "bg-muted text-muted-foreground";
    return STATUS_COLORS[statusCode] || "bg-muted text-muted-foreground";
  };

  const getMethodColor = (method: string) => {
    return METHOD_COLORS[method] || "bg-muted text-muted-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            API Çağrı Detayları
          </DialogTitle>
          <DialogDescription>
            {date && formatDate(date)} tarihinde yapılan tüm API çağrıları
            {pagination.total > 0 && (
              <span className="ml-2 font-semibold">
                (Toplam: {pagination.total} çağrı)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Filter Section */}
        <div className="border-b pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtreler</span>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Filtreleri Temizle
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="method-filter" className="text-xs">
                HTTP Metodu
              </Label>
              <select
                id="method-filter"
                value={filters.method}
                onChange={(e) => handleFilterChange("method", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Tümü</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username-filter" className="text-xs">
                Kullanıcı Adı / E-posta
              </Label>
              <Input
                id="username-filter"
                placeholder="Kullanıcı adı veya e-posta ile ara..."
                value={filters.username}
                onChange={(e) => handleFilterChange("username", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            Hata: {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0">
              {apiCalls.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Bu tarihte API çağrısı bulunamadı
                </div>
              ) : (
                <div className="space-y-2">
                  {apiCalls.map((call) => (
                    <div
                      key={call.id}
                      className="rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={getMethodColor(call.method)}
                            >
                              {call.method}
                            </Badge>
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {call.endpoint}
                            </code>
                            {call.statusCode && (
                              <Badge
                                variant="outline"
                                className={getStatusColor(call.statusCode)}
                              >
                                {call.statusCode}
                              </Badge>
                            )}
                            {call.duration !== null && (
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {call.duration}ms
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(call.createdAt)}
                            </span>
                            {call.user ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {call.user.name || call.user.email}
                                <Badge variant="outline" className="ml-1 text-xs">
                                  {call.user.role}
                                </Badge>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                Kimlik doğrulanmamış
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Sayfa {pagination.page} / {pagination.totalPages} (
                  {pagination.total} toplam)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!pagination.hasPreviousPage || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasNextPage || isLoading}
                  >
                    Sonraki
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

