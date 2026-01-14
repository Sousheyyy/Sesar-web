import { type inferAsyncReturnType } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { auth } from "@/lib/auth";

export const createContext = async (opts: FetchCreateContextFnOptions) => {
    try {
        // 1. Try NextAuth (Cookie)
        const session = await auth();
        if (session?.user) {
            return { user: session.user };
        }
    } catch (e) {
        console.error("Context: auth() failed", e);
    }

    // 2. Try Supabase Auth (Header)
    // Mobile sends: Authorization: Bearer <token>
    const authHeader = opts.req.headers.get("authorization");
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        if (token) {
            try {
                // Dynamically import jwt-decode to avoid edge runtime issues if any
                // Debug logging
                console.log("Context: Importing jwt-decode...");
                const jwtModule = await import("jwt-decode");
                // Handle named vs default export
                const jwtDecode = jwtModule.jwtDecode || (jwtModule as any).default || jwtModule;

                console.log("Context: decoding token...");
                const decoded: any = jwtDecode(token);
                // decoded.sub is the user ID in Supabase
                // We assume this ID matches our DB (since we are using same DB or synced)
                // We need to fetch the user role from our DB to be safe
                if (decoded.sub) {
                    console.log("Context: finding user", decoded.sub);
                    const { prisma } = await import("@/lib/prisma");
                    const dbUser = await prisma.user.findUnique({
                        where: { id: decoded.sub },
                        select: { id: true, role: true, name: true, email: true }
                    });

                    if (dbUser) {
                        console.log("Context: User found", dbUser.id);
                        return {
                            user: {
                                id: dbUser.id,
                                role: dbUser.role,
                                name: dbUser.name,
                                email: dbUser.email,
                            }
                        };
                    } else {
                        console.log("Context: User NOT found in DB");
                    }
                }
            } catch (error) {
                console.error("JWT Decode or DB Error:", error);
            }
        }
    }

    return {
        user: undefined,
    };
};

export type Context = inferAsyncReturnType<typeof createContext>;
