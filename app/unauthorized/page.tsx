import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="text-center">
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
      </div>
    </div>
  );
}


