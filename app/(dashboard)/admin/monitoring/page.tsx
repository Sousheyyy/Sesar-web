import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import MonitoringPageClient from "@/components/admin/monitoring-page-client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  await requireAdmin();

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    logs,
    stats24h,
    upcoming,
    totalActiveSubs,
    apiCallsByProvider,
    apiCallsFailed,
    recentApiCalls,
  ] = await Promise.all([
    // Recent metric fetch logs
    prisma.metricFetchLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: { id: true, title: true } } },
    }),
    // 24h metric fetch stats
    prisma.metricFetchLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: twentyFourHoursAgo } },
      _count: true,
    }),
    // Upcoming campaigns
    prisma.campaign.findMany({
      where: { status: "ACTIVE", nextMetricsFetchAt: { not: null } },
      orderBy: { nextMetricsFetchAt: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        nextMetricsFetchAt: true,
        metricsProcessingAt: true,
        lockedAt: true,
        endDate: true,
        totalBudget: true,
        _count: { select: { submissions: true } },
      },
    }),
    // Active submissions count (for API call estimate)
    prisma.submission.count({
      where: { campaign: { status: "ACTIVE" } },
    }),
    // API calls by provider (24h)
    prisma.apiCallLog.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: twentyFourHoursAgo } },
      _count: true,
      _avg: { duration: true },
    }),
    // Failed API calls by provider (24h)
    prisma.apiCallLog.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: twentyFourHoursAgo }, success: false },
      _count: true,
    }),
    // Recent API calls (last 50)
    prisma.apiCallLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        endpoint: true,
        success: true,
        duration: true,
        errorMessage: true,
        context: true,
        isFallback: true,
        createdAt: true,
      },
    }),
  ]);

  // Aggregate metric fetch stats
  const statsMap: Record<string, number> = {};
  for (const s of stats24h) {
    statsMap[s.status] = s._count;
  }
  const total24h = Object.values(statsMap).reduce((a, b) => a + b, 0);

  // Aggregate API call provider stats
  const providerStatsMap: Record<string, { total: number; avgDuration: number }> = {};
  for (const p of apiCallsByProvider) {
    providerStatsMap[p.provider] = {
      total: p._count,
      avgDuration: Math.round(p._avg.duration ?? 0),
    };
  }
  const failedMap: Record<string, number> = {};
  for (const f of apiCallsFailed) {
    failedMap[f.provider] = f._count;
  }

  // Fallback count (24h)
  const fallbackCount = await prisma.apiCallLog.count({
    where: { createdAt: { gte: twentyFourHoursAgo }, isFallback: true },
  });

  return (
    <MonitoringPageClient
      logs={JSON.parse(JSON.stringify(logs))}
      stats={{
        total24h,
        success: statsMap["SUCCESS"] || 0,
        partial: statsMap["PARTIAL"] || 0,
        failed: statsMap["FAILED"] || 0,
        insurance: statsMap["INSURANCE_TRIGGERED"] || 0,
        retry: statsMap["RETRY"] || 0,
      }}
      upcoming={JSON.parse(JSON.stringify(upcoming))}
      totalActiveSubs={totalActiveSubs}
      apiProviderStats={{
        rapidapi: {
          total: providerStatsMap["RAPIDAPI"]?.total || 0,
          failed: failedMap["RAPIDAPI"] || 0,
          avgDuration: providerStatsMap["RAPIDAPI"]?.avgDuration || 0,
        },
        apify: {
          total: providerStatsMap["APIFY"]?.total || 0,
          failed: failedMap["APIFY"] || 0,
          avgDuration: providerStatsMap["APIFY"]?.avgDuration || 0,
        },
        fallbackCount,
      }}
      recentApiCalls={JSON.parse(JSON.stringify(recentApiCalls))}
    />
  );
}
