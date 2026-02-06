import { NextRequest, NextResponse } from "next/server";

/**
 * InsightIQ Connect SDK Page
 *
 * This endpoint serves an HTML page that loads the InsightIQ Web SDK
 * and handles the TikTok connection flow.
 *
 * Query params:
 * - token: SDK token from createInsightIQToken
 * - userId: InsightIQ user ID
 * - redirectUrl: URL to redirect after connection (mobile deep link)
 * - workPlatformId: (optional) TikTok platform ID to skip platform selection
 */

// Fetch TikTok platform ID from InsightIQ API
async function getTikTokPlatformId(): Promise<string> {
  const baseUrl = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
  const clientId = process.env.INSIGHTIQ_CLIENT_ID;
  const clientSecret = process.env.INSIGHTIQ_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing InsightIQ credentials");
    return "9bb8913b-ddd9-430b-a66a-d74d846e6c66"; // fallback
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    const res = await fetch(`${baseUrl}/v1/work-platforms`, {
      headers: { Authorization: authHeader },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) {
      console.error("Failed to fetch work platforms:", res.status);
      return "9bb8913b-ddd9-430b-a66a-d74d846e6c66"; // fallback
    }

    const data = await res.json();
    console.log("[InsightIQ] Work platforms:", JSON.stringify(data.data?.map((p: any) => ({ id: p.id, name: p.name })), null, 2));

    const tiktok = data.data?.find((p: any) =>
      p.name.toLowerCase() === "tiktok" || p.name.toLowerCase().includes("tiktok")
    );

    if (tiktok) {
      console.log("[InsightIQ] Found TikTok platform:", tiktok.id, tiktok.name);
      return tiktok.id;
    }

    console.warn("[InsightIQ] TikTok platform not found in list");
    return "9bb8913b-ddd9-430b-a66a-d74d846e6c66"; // fallback
  } catch (err) {
    console.error("[InsightIQ] Error fetching platforms:", err);
    return "9bb8913b-ddd9-430b-a66a-d74d846e6c66"; // fallback
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const userId = searchParams.get("userId");
  const redirectUrl = searchParams.get("redirectUrl");

  // Get the correct TikTok platform ID from InsightIQ API
  const tiktokPlatformId = await getTikTokPlatformId();
  const workPlatformId = searchParams.get("workPlatformId") || tiktokPlatformId;

  if (!token || !userId || !redirectUrl) {
    return NextResponse.json(
      { error: "Missing required parameters: token, userId, redirectUrl" },
      { status: 400 }
    );
  }

  // Determine environment based on API URL
  const baseUrl = process.env.INSIGHTIQ_BASE_URL || "";
  let environment = "staging";
  if (baseUrl.includes("sandbox")) {
    environment = "sandbox";
  } else if (!baseUrl.includes("staging")) {
    environment = "production";
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Bağlantısı - Sesar</title>
  <script src="https://cdn.getphyllo.com/connect/v2/phyllo-connect.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #f4258c;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    p {
      color: rgba(255,255,255,0.7);
      font-size: 0.875rem;
    }
    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 1rem;
      border-radius: 8px;
      margin-top: 1rem;
      display: none;
    }
    .error.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner" id="spinner"></div>
    <h1>TikTok Hesabınızı Bağlayın</h1>
    <p id="status">Bağlantı penceresi açılıyor...</p>
    <div class="error" id="error"></div>
  </div>

  <script>
    const config = {
      clientDisplayName: "Sesar",
      environment: "${environment}",
      userId: "${userId}",
      token: "${token}",
      redirect: true,
      redirectURL: "${redirectUrl}",
      singleAccount: true,
      workPlatformId: "${workPlatformId}"
    };

    console.log("[InsightIQ] Initializing SDK with config:", { ...config, token: config.token.substring(0, 20) + "..." });

    function showError(message) {
      document.getElementById("spinner").style.display = "none";
      document.getElementById("status").textContent = "Bir hata oluştu";
      const errorEl = document.getElementById("error");
      errorEl.textContent = message;
      errorEl.classList.add("show");
    }

    try {
      const phylloConnect = PhylloConnect.initialize(config);

      // The redirect flow will automatically redirect after connection
      // These events are for debugging/logging
      phylloConnect.on("accountConnected", (accountId, workplatformId, userId) => {
        console.log("[InsightIQ] Account connected:", accountId);
      });

      phylloConnect.on("exit", (reason, userId) => {
        console.log("[InsightIQ] Exit:", reason);
        if (reason === "TOKEN_EXPIRED") {
          showError("Oturum süresi doldu. Lütfen tekrar deneyin.");
        }
      });

      phylloConnect.on("connectionFailure", (reason, workplatformId, userId) => {
        console.log("[InsightIQ] Connection failure:", reason);
        showError("Bağlantı başarısız: " + reason);
      });

      // Open the SDK
      phylloConnect.open();

    } catch (err) {
      console.error("[InsightIQ] SDK error:", err);
      showError(err.message || "SDK başlatılamadı");
    }
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
