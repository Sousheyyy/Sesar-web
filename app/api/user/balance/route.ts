import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logApiCallSimple, extractEndpoint } from "@/lib/api-logger-simple";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const response = NextResponse.json({ balance: Number(user.balance) });
    // Log API call
    logApiCallSimple(
      extractEndpoint(new URL(req.url).pathname),
      "GET",
      200,
      session.user.id
    );
    return response;
  } catch (error) {
    console.error("Balance fetch error:", error);
    const response = NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
    // Log API call error
    try {
      const session = await auth();
      logApiCallSimple(
        extractEndpoint(new URL(req.url).pathname),
        "GET",
        500,
        session?.user?.id
      );
    } catch {}
    return response;
  }
}








