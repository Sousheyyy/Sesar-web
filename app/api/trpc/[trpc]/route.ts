import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const dynamic = 'force-dynamic';

import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";

// Allowed web origins (mobile native requests have no Origin header)
const ALLOWED_ORIGINS = new Set([
    'https://sesarapp.com',
    'https://www.sesarapp.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:8081'] : []),
]);

function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('origin');

    // Mobile native clients don't send an Origin header.
    // Allow them through (CORS is a browser-only mechanism).
    // For browser requests, validate the origin against the allow-list.
    const allowOrigin = !origin
        ? '*'
        : ALLOWED_ORIGINS.has(origin) ? origin : '';

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

// Handle preflight OPTIONS requests
export async function OPTIONS(req: Request) {
    return new Response(null, {
        status: 200,
        headers: getCorsHeaders(req),
    });
}

// Wrap handler to add CORS headers to responses
const handler = async (req: Request) => {
    const corsHeaders = getCorsHeaders(req);

    const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext,
        onError: ({ path, error }) => {
            console.error(`tRPC Error on '${path}':`, error);
        },
        responseMeta() {
            return { headers: corsHeaders };
        },
    });

    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
};

export { handler as GET, handler as POST };
