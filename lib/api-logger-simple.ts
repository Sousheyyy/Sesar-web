import { prisma } from "@/lib/prisma";

/**
 * Simple function to log API calls - call this from API routes
 * This version doesn't require the full request object
 * Note: duration should be calculated by the caller and passed in
 */
export async function logApiCallSimple(
  endpoint: string,
  method: string,
  statusCode: number,
  userId?: string | null,
  duration?: number
) {
  try {
    // Don't log the analytics API calls route to avoid recursion
    if (endpoint.includes("/api/admin/analytics/api-calls")) {
      return;
    }

    // Log asynchronously to avoid blocking
    setImmediate(async () => {
      try {
        await prisma.apiCallLog.create({
          data: {
            endpoint,
            method,
            statusCode,
            userId: userId || null,
            duration: duration || null,
          },
        });
      } catch (error) {
        // Silently fail logging
        console.error("Failed to log API call:", error);
      }
    });
  } catch (error) {
    // Silently fail
    console.error("Error in logApiCallSimple:", error);
  }
}

/**
 * Extract endpoint from full pathname
 */
export function extractEndpoint(pathname: string): string {
  if (!pathname.startsWith("/api/")) {
    return pathname;
  }
  
  const parts = pathname.split("/");
  // Keep first 3 parts (e.g., /api/campaigns/[id] -> /api/campaigns)
  if (parts.length >= 3) {
    return parts.slice(0, 3).join("/");
  }
  return pathname;
}

