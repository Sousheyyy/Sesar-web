import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UsersPageClient } from "@/components/admin/users-page-client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      balance: true,
      followerCount: true,
      tiktokHandle: true,
      tiktokAvatarUrl: true,
      avatar: true,
      createdAt: true,
      _count: {
        select: {
          campaigns: true,
          submissions: true,
          transactions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const serializedUsers = users.map((user) => ({
    ...user,
    balance: Number(user.balance),
    createdAt: user.createdAt.toISOString(),
  }));

  const stats = {
    total: users.length,
    artists: users.filter((u) => u.role === "ARTIST").length,
    creators: users.filter((u) => u.role === "CREATOR").length,
    admins: users.filter((u) => u.role === "ADMIN").length,
  };

  return <UsersPageClient users={serializedUsers} stats={stats} />;
}
