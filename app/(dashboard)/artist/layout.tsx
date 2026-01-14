import { requireArtist } from "@/lib/auth-utils";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function ArtistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireArtist();
  return children;
}


