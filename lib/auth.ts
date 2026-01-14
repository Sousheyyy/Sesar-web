import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@prisma/client";

/**
 * Unified auth function that works in Server Components and Route Handlers.
 * Bridges the gap between Supabase Auth and our Prisma User profiles.
 */
export async function auth() {
  const supabase = createClient();

  try {
    // Use getUser() to validate the auth token on the server
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      // If user exists in Auth but not in Prisma, they might be being created by the trigger
      // but we return null here to be safe, or we could return partial data.
      return null;
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role as UserRole,
        plan: dbUser.plan,
        balance: Number(dbUser.balance),
        tiktokHandle: dbUser.tiktokHandle,
      },
      // Check session expiry if needed, or null if we rely on the token validity check we just did
      expires: null,
    };
  } catch (err) {
    console.error("Auth helper error:", err);
    return null;
  }
}




