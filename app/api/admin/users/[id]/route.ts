import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_ROLES: UserRole[] = ["ADMIN", "ARTIST", "CREATOR"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();

    const body = await req.json();
    const { role } = body as { role: string };

    if (!role || !VALID_ROLES.includes(role as UserRole)) {
      return NextResponse.json(
        { error: "Geçersiz rol. ADMIN, ARTIST veya CREATOR olmalı." },
        { status: 400 }
      );
    }

    // Prevent changing own role
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Kendi rolünüzü değiştiremezsiniz" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    if (user.role === role) {
      return NextResponse.json(
        { error: "Kullanıcı zaten bu rolde" },
        { status: 400 }
      );
    }

    const oldRole = user.role;

    const updated = await prisma.user.update({
      where: { id },
      data: { role: role as UserRole },
      select: { id: true, role: true },
    });

    logAdminAction(admin.id, admin.email, "USER_ROLE_CHANGE", "User", id, {
      oldRole,
      newRole: role,
      userEmail: user.email,
    });

    return NextResponse.json({ success: true, role: updated.role });
  } catch (error) {
    console.error("Role change error:", error);
    return NextResponse.json(
      { error: "Rol değiştirme başarısız oldu" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();

    // Prevent self-deletion
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Kendi hesabınızı silemezsiniz" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        _count: {
          select: {
            campaigns: { where: { status: "ACTIVE" } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    if (user._count.campaigns > 0) {
      return NextResponse.json(
        { error: "Aktif kampanyası olan kullanıcı silinemez. Önce kampanyaları tamamlayın veya iptal edin." },
        { status: 400 }
      );
    }

    // Delete related records in order, then the user
    await prisma.$transaction([
      prisma.submission.deleteMany({ where: { creatorId: id } }),
      prisma.transaction.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.campaign.deleteMany({ where: { artistId: id } }),
      prisma.song.deleteMany({ where: { artistId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    logAdminAction(admin.id, admin.email, "USER_DELETE", "User", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Kullanıcı silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
