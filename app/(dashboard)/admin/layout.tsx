import { requireAdmin } from "@/lib/auth-utils";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}


