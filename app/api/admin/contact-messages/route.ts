import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Contact messages GET error:", error);
    return NextResponse.json({ error: "Mesajlar yüklenemedi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id, read } = body as { id: string; read: boolean };

    if (!id || typeof read !== "boolean") {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }

    const updated = await prisma.contactMessage.update({
      where: { id },
      data: { read },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Contact message PATCH error:", error);
    return NextResponse.json({ error: "Mesaj güncellenemedi" }, { status: 500 });
  }
}
