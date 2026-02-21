import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const setting = await prisma.systemSettings.findUnique({
    where: { key: "privacy_content" },
  });

  const content = setting?.value || null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/profile">
        <Button variant="ghost" size="sm" className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Geri Dön
        </Button>
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-4">Gizlilik Politikası</h1>
      {content ? (
        <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      ) : (
        <p className="text-muted-foreground">
          Bu sayfa yakında güncellenecektir.
        </p>
      )}
    </div>
  );
}
