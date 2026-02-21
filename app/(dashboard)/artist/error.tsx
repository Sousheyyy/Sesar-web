"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function ArtistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Artist panel error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Bir Hata Oluştu</h1>

        <p className="text-muted-foreground mb-8">
          Beklenmeyen bir hata meydana geldi. Lütfen tekrar deneyin veya ana
          sayfaya dönün.
        </p>

        {error.digest && (
          <p className="text-xs text-muted-foreground mb-4">
            Hata kodu: {error.digest}
          </p>
        )}

        <div className="flex gap-4 justify-center">
          <Button onClick={reset} variant="outline">
            Tekrar Dene
          </Button>
          <Link href="/artist">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ana Sayfaya Dön
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
