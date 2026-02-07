import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const dynamic = 'force-dynamic';

import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";

// CORS headers for mobile app support
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

// Handle preflight OPTIONS requests
export async function OPTIONS(req: Request) {
    return new Response(null, {
        status: 200,
        headers: corsHeaders,
    });
}

// Wrap handler to add CORS headers to responses
const handler = async (req: Request) => {
    const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext,
        onError: ({ path, error }) => {
            console.error(`tRPC Error on '${path}':`, error);
        },
        responseMeta() {
            return {
                headers: corsHeaders,
            };
        },
    });

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
};

export { handler as GET, handler as POST };
