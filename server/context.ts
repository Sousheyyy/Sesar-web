import { type inferAsyncReturnType } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { auth } from "@/lib/auth";

// Singleton Supabase admin client for Bearer token verification
let supabaseAdmin: ReturnType<typeof createSupabaseClient> | null = null;

function getSupabaseAdmin() {
    if (!supabaseAdmin) {
        supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );
    }
    return supabaseAdmin;
}

// In-memory cache for verified tokens (reduces Supabase API calls)
const tokenCache = new Map<string, { userId: string; expiresAt: number }>();
const TOKEN_CACHE_TTL = 60_000; // 60 seconds

async function verifyBearerToken(token: string): Promise<string | null> {
    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.userId;
    }

    try {
        const admin = getSupabaseAdmin();
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data.user) return null;

        tokenCache.set(token, {
            userId: data.user.id,
            expiresAt: Date.now() + TOKEN_CACHE_TTL,
        });

        // Evict expired entries to prevent memory leak
        if (tokenCache.size > 500) {
            const now = Date.now();
            for (const [key, val] of tokenCache) {
                if (now >= val.expiresAt) tokenCache.delete(key);
            }
        }

        return data.user.id;
    } catch {
        return null;
    }
}

// Context: ONLY handles authentication (token verification).
// Returns { userId } — no Prisma lookup. Each procedure fetches its own data.
export const createContext = async (opts: FetchCreateContextFnOptions) => {
    // 1. Try cookie-based auth (web sessions via NextAuth)
    try {
        const session = await auth();
        if (session?.user?.id) {
            return { userId: session.user.id };
        }
    } catch {
        // Cookie auth failed — fall through to Bearer token
    }

    // 2. Try Bearer token auth (mobile clients)
    const authHeader = opts.req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        if (token) {
            const userId = await verifyBearerToken(token);
            if (userId) {
                return { userId };
            }
        }
    }

    return { userId: null };
};

export type Context = inferAsyncReturnType<typeof createContext>;
