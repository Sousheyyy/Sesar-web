import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint to list all available work platforms from InsightIQ
 * This helps identify the correct platform IDs
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
  const clientId = process.env.INSIGHTIQ_CLIENT_ID;
  const clientSecret = process.env.INSIGHTIQ_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing InsightIQ credentials" }, { status: 500 });
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    const res = await fetch(`${baseUrl}/v1/work-platforms`, {
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({
        error: "Failed to fetch platforms",
        status: res.status,
        details: errorText
      }, { status: res.status });
    }

    const data = await res.json();

    // Find TikTok specifically
    const tiktok = data.data?.find((p: any) =>
      p.name.toLowerCase() === "tiktok" ||
      p.name.toLowerCase().includes("tiktok")
    );

    return NextResponse.json({
      tiktok: tiktok || null,
      tiktokId: tiktok?.id || "NOT FOUND",
      allPlatforms: data.data?.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
      })),
      total: data.data?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: "Error fetching platforms",
      message: err.message
    }, { status: 500 });
  }
}
