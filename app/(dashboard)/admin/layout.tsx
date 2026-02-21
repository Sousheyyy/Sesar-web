import { requireAdmin } from "@/lib/auth-utils";
import { SessionTimeout } from "@/components/admin/session-timeout";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <SessionTimeout timeoutMinutes={30} warningMinutes={1} />
      {children}
    </>
  );
}


