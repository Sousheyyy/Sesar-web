import { NextRequest, NextResponse } from "next/server";
import { processEndedCampaigns } from "@/lib/payout";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

/**
 * Cron endpoint to process payouts for ended campaigns
 * This should be called periodically (e.g., every hour) by a cron service
 * 
 * For security, this endpoint can be:
 * 1. Protected by a cron secret token (recommended for production)
 * 2. Restricted to admin users only
 */
export async function POST(req: NextRequest) {
  try {
    // Option 1: Check for cron secret (recommended for production cron services)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Valid cron secret, proceed
    } else {
      // Option 2: Fallback to admin authentication
      const session = await auth();
      
      if (!session?.user || session.user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: "Unauthorized. Admin access or valid cron secret required." },
          { status: 401 }
        );
      }
    }

    // Process all ended campaigns
    const result = await processEndedCampaigns();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Payout cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process payouts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual trigger by admins (for testing/debugging)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 401 }
      );
    }

    const result = await processEndedCampaigns();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Payout processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process payouts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}






