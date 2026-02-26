"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  Zap,
  Timer,
  Lock,
  Loader2,
  ArrowRightLeft,
  Globe,
  Server,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MonitoringProps {
  logs: Array<{
    id: string;
    campaignId: string;
    source: string;
    status: string;
    errorMessage: string | null;
    metricsSnapshot: any;
    createdAt: string;
    campaign: { id: string; title: string } | null;
  }>;
  stats: {
    total24h: number;
    success: number;
    partial: number;
    failed: number;
    insurance: number;
    retry: number;
  };
  upcoming: Array<{
    id: string;
    title: string;
    nextMetricsFetchAt: string | null;
    metricsProcessingAt: string | null;
    lockedAt: string | null;
    endDate: string | null;
    totalBudget: number;
    _count: { submissions: number };
  }>;
  totalActiveSubs: number;
  apiProviderStats: {
    rapidapi: { total: number; failed: number; avgDuration: number };
    apify: { total: number; failed: number; avgDuration: number };
    fallbackCount: number;
  };
  recentApiCalls: Array<{
    id: string;
    provider: string;
    endpoint: string;
    success: boolean;
    duration: number | null;
    errorMessage: string | null;
    context: string | null;
    isFallback: boolean;
    createdAt: string;
  }>;
}

type StatusFilter = "all" | "SUCCESS" | "PARTIAL" | "FAILED" | "INSURANCE_TRIGGERED" | "RETRY" | "SKIPPED";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;

  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    if (absDiff < 60_000) return `${Math.floor(absDiff / 1000)} sn sonra`;
    if (absDiff < 3_600_000) return `${Math.floor(absDiff / 60_000)} dk sonra`;
    if (absDiff < 86_400_000) return `${Math.floor(absDiff / 3_600_000)} saat sonra`;
    return `${Math.floor(absDiff / 86_400_000)} gun sonra`;
  }

  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)} sn once`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} dk once`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} saat once`;
  return `${Math.floor(diffMs / 86_400_000)} gun once`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  SUCCESS: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PARTIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  INSURANCE_TRIGGERED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  RETRY: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  SKIPPED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Basarili",
  PARTIAL: "Kismi",
  FAILED: "Basarisiz",
  INSURANCE_TRIGGERED: "Sigorta",
  RETRY: "Tekrar",
  SKIPPED: "Atlandi",
};

const PROVIDER_COLORS: Record<string, string> = {
  RAPIDAPI: "text-cyan-400",
  APIFY: "text-amber-400",
  TIKTOK_OAUTH: "text-pink-400",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MonitoringPageClient({
  logs,
  stats,
  upcoming,
  totalActiveSubs,
  apiProviderStats,
  recentApiCalls,
}: MonitoringProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredLogs = useMemo(() => {
    if (statusFilter === "all") return logs;
    return logs.filter((l) => l.status === statusFilter);
  }, [logs, statusFilter]);

  const successRate =
    stats.total24h > 0
      ? Math.round((stats.success / stats.total24h) * 100)
      : 0;

  const processingCampaigns = upcoming.filter(
    (c) => c.metricsProcessingAt !== null
  );

  const recentlyFailed = logs.filter(
    (l) => l.status === "FAILED" || l.status === "RETRY"
  );

  const totalApiCalls = apiProviderStats.rapidapi.total + apiProviderStats.apify.total;
  const rapidApiSuccessRate = apiProviderStats.rapidapi.total > 0
    ? Math.round(((apiProviderStats.rapidapi.total - apiProviderStats.rapidapi.failed) / apiProviderStats.rapidapi.total) * 100)
    : 0;

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Tumu" },
    { value: "SUCCESS", label: "Basarili" },
    { value: "PARTIAL", label: "Kismi" },
    { value: "FAILED", label: "Basarisiz" },
    { value: "INSURANCE_TRIGGERED", label: "Sigorta" },
    { value: "RETRY", label: "Tekrar" },
    { value: "SKIPPED", label: "Atlandi" },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 mb-2">
          <Shield className="w-3 h-3" />
          <span>Yonetici Paneli</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Cron & API Izleme
        </h2>
        <p className="text-zinc-400 mt-1">
          API saglayici istatistikleri, cron islemleri ve kampanya sagligi
        </p>
      </div>

      {/* ─── API Provider Stats ───────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">
            API Saglayici Durumu (24 saat)
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* RapidAPI */}
          <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">RapidAPI</span>
              <span className="ml-auto text-xs text-zinc-500">Birincil</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {apiProviderStats.rapidapi.total.toLocaleString("tr-TR")}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-zinc-500">
                {apiProviderStats.rapidapi.failed > 0 ? (
                  <span className="text-red-400">{apiProviderStats.rapidapi.failed} basarisiz</span>
                ) : (
                  <span className="text-emerald-400">%{rapidApiSuccessRate} basari</span>
                )}
              </span>
              <span className="text-xs text-zinc-500">
                ort. {apiProviderStats.rapidapi.avgDuration}ms
              </span>
            </div>
          </div>

          {/* Apify */}
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Apify</span>
              <span className="ml-auto text-xs text-zinc-500">Yedek</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {apiProviderStats.apify.total.toLocaleString("tr-TR")}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-zinc-500">
                {apiProviderStats.apify.failed > 0 && (
                  <span className="text-red-400">{apiProviderStats.apify.failed} basarisiz</span>
                )}
                {apiProviderStats.apify.failed === 0 && apiProviderStats.apify.total > 0 && (
                  <span className="text-emerald-400">Tumu basarili</span>
                )}
                {apiProviderStats.apify.total === 0 && (
                  <span className="text-zinc-500">Cagri yok</span>
                )}
              </span>
              {apiProviderStats.apify.avgDuration > 0 && (
                <span className="text-xs text-zinc-500">
                  ort. {apiProviderStats.apify.avgDuration}ms
                </span>
              )}
            </div>
          </div>

          {/* Fallback Count */}
          <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-medium text-orange-400 uppercase tracking-wider">Fallback</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {apiProviderStats.fallbackCount.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              RapidAPI basarisiz → Apify
            </p>
          </div>

          {/* Total API Calls */}
          <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Toplam</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {totalApiCalls.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {totalActiveSubs} aktif gonderi
            </p>
          </div>
        </div>
      </div>

      {/* ─── Cron Overview Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Cron Runs */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">
              Cron Calismalari (24s)
            </p>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/20">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.total24h.toLocaleString("tr-TR")}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Son 24 saatteki toplam islem
          </p>
        </div>

        {/* Success Rate */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">
              Basari Orani
            </p>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            %{successRate}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {stats.success} basarili / {stats.total24h} toplam
          </p>
        </div>

        {/* Failed/Retry */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-md p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">
              Basarisiz / Tekrar
            </p>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/20">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {(stats.failed + stats.retry).toLocaleString("tr-TR")}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {stats.failed} basarisiz, {stats.retry} tekrar deneme
          </p>
        </div>

        {/* Estimated Upcoming Calls */}
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-md p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">
              Tahmini API Cagrisi
            </p>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-yellow-500/20">
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {totalActiveSubs.toLocaleString("tr-TR")}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Aktif kampanya gonderileri
          </p>
        </div>
      </div>

      {/* ─── Campaign Health (Processing / Failed) ──────────────── */}
      {(processingCampaigns.length > 0 || recentlyFailed.length > 0) && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 backdrop-blur-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">
              Kampanya Sagligi
            </h3>
          </div>

          {processingCampaigns.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
                Su An Isleniyor
              </p>
              <div className="space-y-2">
                {processingCampaigns.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                  >
                    <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="text-sm text-white hover:text-purple-300 transition-colors truncate"
                    >
                      {c.title}
                    </Link>
                    <span className="text-xs text-zinc-500 ml-auto">
                      {formatRelativeTime(c.metricsProcessingAt!)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentlyFailed.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
                Son Basarisiz Islemler
              </p>
              <div className="space-y-2">
                {recentlyFailed.slice(0, 5).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                  >
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <Link
                      href={`/admin/campaigns/${l.campaignId}`}
                      className="text-sm text-white hover:text-purple-300 transition-colors truncate"
                    >
                      {l.campaign?.title || l.campaignId}
                    </Link>
                    <span className="text-xs text-zinc-500 truncate max-w-[200px]">
                      {l.errorMessage || "-"}
                    </span>
                    <span className="text-xs text-zinc-500 ml-auto flex-shrink-0">
                      {formatRelativeTime(l.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Upcoming Schedule ──────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-cyan-400" />
            <h3 className="text-lg font-medium text-white">
              Yaklasan Zamanlamalar
            </h3>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Metrik toplama sirasi bekleyen aktif kampanyalar
          </p>
        </div>

        {upcoming.length === 0 ? (
          <div className="px-5 py-8 text-center text-zinc-500 text-sm">
            Zamanlanmis kampanya yok
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Kampanya
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Sonraki Toplama
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Gonderi
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Butce
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Bitis
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Durum
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="text-white hover:text-purple-300 transition-colors font-medium truncate block max-w-[200px]"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span className="text-zinc-300">
                          {c.nextMetricsFetchAt
                            ? formatRelativeTime(c.nextMetricsFetchAt)
                            : "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-300">
                      {c._count.submissions}
                    </td>
                    <td className="px-5 py-3 text-zinc-300">
                      {formatCurrency(Number(c.totalBudget))}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {formatDateTime(c.endDate)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {c.metricsProcessingAt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Isleniyor
                          </span>
                        )}
                        {c.lockedAt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-red-500/10 text-red-400 border-red-500/20">
                            <Lock className="w-3 h-3" />
                            Kilitli
                          </span>
                        )}
                        {!c.metricsProcessingAt && !c.lockedAt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" />
                            Hazir
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Recent API Calls ─────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-lg font-medium text-white">
              Son API Cagrilari
            </h3>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            RapidAPI ve Apify cagrilari (son 50)
          </p>
        </div>

        {recentApiCalls.length === 0 ? (
          <div className="px-5 py-8 text-center text-zinc-500 text-sm">
            Henuz API cagrisi yok
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Zaman
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Saglayici
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Sure
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Kaynak
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Hata
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentApiCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-5 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {formatRelativeTime(call.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${PROVIDER_COLORS[call.provider] || "text-zinc-400"}`}>
                          {call.provider}
                        </span>
                        {call.isFallback && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            Yedek
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-zinc-300 font-mono">
                        {call.endpoint}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {call.success ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" />
                          OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-red-500/10 text-red-400 border-red-500/20">
                          <XCircle className="w-3 h-3" />
                          Hata
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {call.duration ? `${call.duration}ms` : "-"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-zinc-500">
                        {call.context || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-red-400 truncate max-w-[200px]">
                      {call.errorMessage || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Metric Fetch Logs ────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-400" />
                <h3 className="text-lg font-medium text-white">
                  Metrik Toplama Kayitlari
                </h3>
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Son 100 cron islem kaydi
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-1.5">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === opt.value
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10 hover:text-zinc-300"
                  }`}
                >
                  {opt.label}
                  {opt.value !== "all" && (
                    <span className="ml-1 text-zinc-500">
                      {logs.filter((l) =>
                        opt.value === "all" ? true : l.status === opt.value
                      ).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="px-5 py-8 text-center text-zinc-500 text-sm">
            Bu filtreyle eslesen kayit yok
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Zaman
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Kaynak
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Kampanya
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Mesaj
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-5 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {formatRelativeTime(log.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs bg-white/5 text-zinc-300 border border-white/10">
                        {log.source}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                          STATUS_BADGE_CLASSES[log.status] ||
                          "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {STATUS_LABELS[log.status] || log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {log.campaign ? (
                        <Link
                          href={`/admin/campaigns/${log.campaign.id}`}
                          className="text-white hover:text-purple-300 transition-colors truncate block max-w-[180px]"
                        >
                          {log.campaign.title}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs truncate max-w-[300px]">
                      {log.errorMessage || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
