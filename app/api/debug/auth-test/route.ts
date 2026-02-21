import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    // Step 1: Test cookies()
    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      steps.cookies = {
        ok: true,
        count: allCookies.length,
        names: allCookies.map(c => c.name),
      };
    } catch (e: any) {
      steps.cookies = { ok: false, error: e.message };
    }

    // Step 2: Test process.env
    steps.env = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Step 3: Test Supabase client creation
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      steps.supabaseClient = { ok: true };

      // Step 4: Test getUser
      try {
        const { data, error } = await supabase.auth.getUser();
        steps.getUser = {
          ok: !error,
          hasUser: !!data?.user,
          userId: data?.user?.id?.substring(0, 8) + '...',
          error: error?.message,
        };
      } catch (e: any) {
        steps.getUser = { ok: false, error: e.message };
      }
    } catch (e: any) {
      steps.supabaseClient = { ok: false, error: e.message };
    }

    // Step 5: Test Prisma
    try {
      const { prisma } = await import("@/lib/prisma");
      const count = await prisma.user.count();
      steps.prisma = { ok: true, userCount: count };
    } catch (e: any) {
      steps.prisma = { ok: false, error: e.message };
    }

    // Step 6: Test full auth()
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      steps.auth = {
        ok: true,
        hasSession: !!session,
        userId: session?.user?.id?.substring(0, 8) + '...',
        role: session?.user?.role,
      };
    } catch (e: any) {
      steps.auth = { ok: false, error: e.message };
    }

    return NextResponse.json({ steps, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({
      steps,
      fatalError: e.message,
      stack: e.stack?.split('\n').slice(0, 5),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
