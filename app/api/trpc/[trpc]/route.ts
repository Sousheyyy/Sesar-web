import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";

const handler = (req: Request) =>
    fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext,
        onError: ({ path, error }) => {
            console.error(`tRPC Error on '${path}':`, error);
        },
    });

export { handler as GET, handler as POST };
