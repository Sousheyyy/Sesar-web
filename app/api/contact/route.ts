import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, message } = body;

    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Konu ve mesaj alanları zorunludur" },
        { status: 400 }
      );
    }

    // Auth is optional — attach userId if logged in
    const session = await auth();
    const userId = session?.user?.id || null;
    const email = session?.user?.email || "anonymous@unknown.com";
    const name = session?.user?.name || null;

    await prisma.contactMessage.create({
      data: {
        userId,
        name,
        email,
        subject: subject.trim(),
        message: message.trim(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Mesaj gönderilemedi" },
      { status: 500 }
    );
  }
}
