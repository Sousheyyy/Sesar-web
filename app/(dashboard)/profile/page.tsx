import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireAuth();

  // Fetch user data
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      tiktokHandle: true,
      createdAt: true,
      role: true,
      balance: true,
      followerCount: true,
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

      <Card>
        <CardHeader>
          <CardTitle>Profil Bilgileri</CardTitle>
          <CardDescription>Hesap detaylarınız</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {userData.name && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ad</p>
                <p className="text-base">{userData.name}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">E-posta</p>
              <p className="text-base">{userData.email}</p>
            </div>
            {userData.tiktokHandle && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">TikTok Kullanıcı Adı</p>
                <p className="text-base">@{userData.tiktokHandle}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rol</p>
              <p className="text-base">{userData.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bakiye</p>
              <p className="text-base">${userData.balance.toString()}</p>
            </div>
            {userData.followerCount !== null && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Takipçi Sayısı</p>
                <p className="text-base">{userData.followerCount.toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

