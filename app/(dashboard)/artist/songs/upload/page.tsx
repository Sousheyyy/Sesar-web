"use client";

import { useRouter } from "next/navigation";
import { SongUpload } from "@/components/upload/song-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default function UploadSongPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/artist/songs");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/artist/songs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Şarkı Yükle</h2>
          <p className="text-muted-foreground">
            Kütüphanenize yeni bir şarkı ekleyin
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Şarkı Detayları</CardTitle>
          <CardDescription>
            Ses dosyanızı yükleyin ve şarkınız hakkında bilgi sağlayın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SongUpload onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </div>
  );
}

