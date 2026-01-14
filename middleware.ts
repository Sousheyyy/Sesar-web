// Temporarily disabled middleware to diagnose Cloudflare Workers timeout
// All auth checks are handled in route handlers
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Pass through all requests - no blocking operations
  // Auth is handled in individual route handlers
  return NextResponse.next();
}

// Minimal matcher - only match routes that absolutely need middleware
// Empty matcher means middleware won't run (for testing)
export const config = {
  matcher: [],
};








