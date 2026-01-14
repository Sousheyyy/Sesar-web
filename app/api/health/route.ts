// Simple health check endpoint - no database calls
// Compatible with Cloudflare Workers (no nodejs runtime)
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: 'cloudflare-workers',
    },
    { status: 200 }
  );
}
