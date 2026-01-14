import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

/**
 * Extract endpoint from pathname (e.g., "/api/campaigns" from "/api/campaigns/123")
 */
function extractEndpoint(pathname: string): string {
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

/**
 * Log API call to database (runs in Node.js runtime, not Edge)
 */
export async function logApiCall(
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number,
  userId?: string | null
) {
  try {
    // Log asynchronously to avoid blocking the request
    prisma.apiCallLog
      .create({
        data: {
          endpoint,
          method,
          statusCode,
          userId: userId || null,
          duration,
        },
      })
      .catch((error) => {
        // Silently fail logging to avoid breaking the app
        console.error("Failed to log API call:", error);
      });
  } catch (error) {
    // Silently fail logging to avoid breaking the app
    console.error("Error in logApiCall:", error);
  }
}

/**
 * Higher-order function to wrap API route handlers with logging
 */
export function withApiLogging<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  endpoint?: string
) {
  return async (...args: T): Promise<Response> => {
    const startTime = Date.now();
    let statusCode = 500;
    let userId: string | null = null;

    try {
      // Extract request from args (usually first parameter)
      const req = args[0] as NextRequest;

      // Get endpoint from pathname or use provided
      const pathname = req.url ? new URL(req.url).pathname : "";
      const finalEndpoint = endpoint || extractEndpoint(pathname);
      const method = req.method;

      // Try to get user ID from session (if available)
      try {
        const { auth } = await import("@/lib/auth");
        const session = await auth();
        userId = session?.user?.id || null;
      } catch {
        // Ignore if session can't be retrieved
      }

      // Execute the handler
      const response = await handler(...args);

      // Get status code from response
      statusCode = response.status;

      // Log the API call (async, won't block)
      const duration = Date.now() - startTime;
      logApiCall(finalEndpoint, method, statusCode, duration, userId);

      return response;
    } catch (error) {
      // Log error case
      const duration = Date.now() - startTime;
      const req = args[0] as NextRequest;
      const pathname = req.url ? new URL(req.url).pathname : "";
      const finalEndpoint = endpoint || extractEndpoint(pathname);
      const method = req.method;

      logApiCall(finalEndpoint, method, statusCode, duration, userId);

      throw error;
    }
  };
}

