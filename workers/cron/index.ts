// Sesar Cron Worker
//
// A lightweight Cloudflare Worker that runs on a schedule
// and calls the main sesar-web API cron endpoints via HTTP.
//
// Cron schedules (configured in workers/cron/wrangler.jsonc):
//   every 5 min    -> campaign-lifecycle
//   0 21 * * *     -> daily-metrics (21:00 UTC = midnight Istanbul)

interface Env {
  CRON_SECRET: string;
  APP_URL: string; // e.g. "https://sesarapp.com"
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ) {
    const cron = controller.cron;
    const headers = {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "Content-Type": "application/json",
    };

    console.log(`[Cron] Triggered: ${cron} at ${new Date().toISOString()}`);

    try {
      if (cron === "*/5 * * * *") {
        // Campaign lifecycle — lock + distribute
        const res = await fetch(`${env.APP_URL}/api/cron/campaign-lifecycle`, {
          method: "POST",
          headers,
        });
        const body = await res.text();
        console.log(`[Cron] campaign-lifecycle: ${res.status} ${body.substring(0, 200)}`);
      }

      if (cron === "0 21 * * *") {
        // Daily metrics refresh
        const res = await fetch(`${env.APP_URL}/api/cron/daily-metrics`, {
          method: "POST",
          headers,
        });
        const body = await res.text();
        console.log(`[Cron] daily-metrics: ${res.status} ${body.substring(0, 200)}`);
      }
    } catch (error: any) {
      console.error(`[Cron] Error for ${cron}:`, error.message);
    }
  },

  // Health check — allows manual testing via HTTP
  async fetch(request: Request, env: Env) {
    return new Response(
      JSON.stringify({ status: "ok", worker: "sesar-cron" }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
