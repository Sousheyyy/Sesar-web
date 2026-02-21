import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { ProfileContent } from "@/components/profile/profile-content";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireAuth();

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      tiktokHandle: true,
      instagramHandle: true,
      youtubeHandle: true,
      role: true,
      balance: true,
      createdAt: true,
    },
  });

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Kullanıcı bulunamadı</p>
      </div>
    );
  }

  return (
    <ProfileContent
      user={{
        id: userData.id,
        name: userData.name,
        email: userData.email,
        bio: userData.bio,
        tiktokHandle: userData.tiktokHandle,
        instagramHandle: userData.instagramHandle,
        youtubeHandle: userData.youtubeHandle,
        role: userData.role,
        balance: Number(userData.balance),
        createdAt: userData.createdAt.toISOString(),
      }}
    />
  );
}
