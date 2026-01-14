// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

// Auth.js v5 (NextAuth v5) - Cloudflare Workers compatible
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;








