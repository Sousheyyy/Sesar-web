import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { TikTokConnect } from "@/components/profile/tiktok-connect";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireAuth();

  // Fetch TikTok handle, email, and creation date
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      tiktokHandle: true,
      email: true,
      createdAt: true,
    },
  });

  if (!userData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profil</h2>
          <p className="text-muted-foreground">Kullanıcı bulunamadı</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profil</h2>
        <p className="text-muted-foreground">Hesap ayarlarınızı yönetin</p>
      </div>

      <TikTokConnect />
    </div>
  );
}

