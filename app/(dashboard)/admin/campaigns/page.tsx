import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { CampaignsPageClient } from "@/components/admin/campaigns-page-client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  await requireAdmin();

  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      totalBudget: true,
      remainingBudget: true,
      commissionPercent: true,
      durationDays: true,
      createdAt: true,
      startDate: true,
      endDate: true,
      song: {
        select: { title: true },
      },
      artist: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { submissions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = campaigns.map((c) => ({
    ...c,
    totalBudget: Number(c.totalBudget),
    remainingBudget: Number(c.remainingBudget),
    createdAt: c.createdAt.toISOString(),
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
  }));

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === "ACTIVE").length,
    completed: campaigns.filter((c) => c.status === "COMPLETED").length,
  };

  return <CampaignsPageClient campaigns={serialized} stats={stats} />;
}
