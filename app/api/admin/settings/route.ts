import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const rows = await prisma.systemSettings.findMany();
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Ayarlar yüklenemedi" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await req.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }

    const ALLOWED_KEYS = new Set([
      "platformFeePercent", "minCampaignBudget", "maxCampaignBudget",
      "minDurationDays", "maxDurationDays", "insuranceThreshold",
      "robinHoodCap", "minWithdrawal", "maxWithdrawal",
      "maintenanceMode", "announcementMessage",
    ]);

    const entries = Object.entries(settings);
    for (const [key, value] of entries) {
      if (!ALLOWED_KEYS.has(key) || key.length > 50 || String(value).length > 500) {
        return NextResponse.json({ error: `Geçersiz ayar anahtarı: ${key}` }, { status: 400 });
      }
    }

    // Upsert each setting sequentially (CF Workers safe)
    for (const [key, value] of entries) {
      await prisma.systemSettings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    logAdminAction(admin.id, admin.email, "SETTINGS_UPDATE", "Settings", undefined, { keys: Object.keys(settings) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Ayarlar kaydedilemedi" }, { status: 500 });
  }
}
