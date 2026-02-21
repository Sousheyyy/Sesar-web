import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { SettingsPageClient } from "@/components/admin/settings-page-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  // Fetch settings
  const settingsRows = await prisma.systemSettings.findMany();
  const settings: Record<string, string> = {};
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }

  // Fetch contact messages
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  const serializedMessages = messages.map((msg) => ({
    ...msg,
    createdAt: msg.createdAt.toISOString(),
  }));

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <SettingsPageClient
      initialSettings={settings}
      initialMessages={serializedMessages}
      unreadCount={unreadCount}
    />
  );
}
