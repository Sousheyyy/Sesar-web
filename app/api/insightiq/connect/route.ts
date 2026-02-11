import { NextRequest } from "next/server";

/**
 * GET /api/insightiq/connect
 *
 * Serves an HTML page that loads the Phyllo Connect SDK (redirect flow).
 * Called from the mobile app via WebBrowser.openAuthSessionAsync().
 *
 * Query params:
 *  - token: SDK token from createInsightIQToken
 *  - userId: Phyllo user ID
 *  - redirectUrl: mobile deep link for callback (e.g. tikpay://auth/tiktok-callback)
 *  - workPlatformId: TikTok platform ID
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const userId = searchParams.get("userId");
  const redirectUrl = searchParams.get("redirectUrl");
  const workPlatformId = searchParams.get("workPlatformId");

  if (!token || !userId || !redirectUrl) {
    return new Response("Missing required parameters: token, userId, redirectUrl", {
      status: 400,
    });
  }

  // Derive Phyllo SDK environment from INSIGHTIQ_BASE_URL
  const baseUrl = process.env.INSIGHTIQ_BASE_URL || "https://api.staging.insightiq.ai";
  let environment = "staging";
  if (baseUrl.includes("sandbox")) {
    environment = "sandbox";
  } else if (baseUrl.includes("staging")) {
    environment = "staging";
  } else {
    environment = "production";
  }

  // Escape values for safe embedding in HTML/JS
  const safeToken = escapeForJS(token);
  const safeUserId = escapeForJS(userId);
  const safeRedirectUrl = escapeForJS(redirectUrl);
  const safeWorkPlatformId = workPlatformId ? escapeForJS(workPlatformId) : null;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TikTok Hesabını Bağla - Sesar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(244, 37, 140, 0.2);
      border-top-color: #f4258c;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #a1a1aa; font-size: 0.875rem; }
    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 1rem;
      border-radius: 0.75rem;
      margin-top: 1rem;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner" id="spinner"></div>
    <h1>TikTok Hesabını Bağla</h1>
    <p id="status">Bağlantı penceresi açılıyor...</p>
    <div class="error" id="error"></div>
  </div>

  <script src="https://cdn.getphyllo.com/connect/v2/phyllo-connect.js"></script>
  <script>
    (function() {
      var token = "${safeToken}";
      var userId = "${safeUserId}";
      var redirectUrl = "${safeRedirectUrl}";
      var workPlatformId = ${safeWorkPlatformId ? `"${safeWorkPlatformId}"` : "null"};
      var environment = "${environment}";

      function showError(msg) {
        document.getElementById("spinner").style.display = "none";
        document.getElementById("status").textContent = "Bir hata oluştu";
        var el = document.getElementById("error");
        el.textContent = msg;
        el.style.display = "block";
      }

      // Wait for PhylloConnect to be available
      function initSDK() {
        if (typeof PhylloConnect === "undefined") {
          showError("SDK yüklenemedi. Lütfen sayfayı yenileyin.");
          return;
        }

        try {
          var config = {
            clientDisplayName: "Sesar",
            environment: environment,
            userId: userId,
            token: token,
            redirect: true,
            redirectURL: redirectUrl,
            singleAccount: true,
          };

          if (workPlatformId) {
            config.workPlatformId = workPlatformId;
          }

          var phylloConnect = PhylloConnect.initialize(config);
          phylloConnect.open();

          document.getElementById("status").textContent = "TikTok giriş sayfası yükleniyor...";
        } catch (err) {
          showError("SDK başlatılamadı: " + (err.message || err));
        }
      }

      // Small delay to ensure script is fully loaded
      if (document.readyState === "complete") {
        setTimeout(initSDK, 300);
      } else {
        window.addEventListener("load", function() {
          setTimeout(initSDK, 300);
        });
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Escape a string for safe embedding in JavaScript string literals */
function escapeForJS(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/</g, "\\x3c")
    .replace(/>/g, "\\x3e")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}
