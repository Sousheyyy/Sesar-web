import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Smartphone } from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const isMobileOnly = searchParams.reason === "mobile-only";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="text-center max-w-md">
        {isMobileOnly ? (
          <>
            <Smartphone className="mx-auto h-24 w-24 text-purple-600 mb-6" />
            <h1 className="text-4xl font-bold mb-4">Mobil Uygulama Kullanın</h1>
            <p className="text-xl text-muted-foreground mb-4">
              İçerik üreticileri için özel mobil uygulamamızı indirin.
            </p>
            <p className="text-base text-muted-foreground mb-8">
              Kampanyalara katılmak, video göndermek ve kazancınızı takip etmek için mobil
              uygulamamızı kullanmanız gerekmektedir.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button>Ana Sayfa</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert className="mx-auto h-24 w-24 text-destructive mb-6" />
            <h1 className="text-4xl font-bold mb-4">Yetkisiz Erişim</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Bu sayfaya erişim yetkiniz bulunmamaktadır.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/dashboard">
                <Button>Panele Git</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Ana Sayfa</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


