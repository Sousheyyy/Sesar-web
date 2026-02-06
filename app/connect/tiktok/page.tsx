"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Script from "next/script";

declare global {
    interface Window {
        PhylloConnect: {
            initialize: (config: any) => {
                open: () => void;
                on: (event: string, callback: (...args: any[]) => void) => void;
            };
            version: () => { connect_web_sdk_version: string };
        };
    }
}

function TikTokConnectContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "connecting" | "success" | "error">("loading");
    const [message, setMessage] = useState("SDK yükleniyor...");
    const [sdkLoaded, setSdkLoaded] = useState(false);

    const token = searchParams.get("token");
    const userId = searchParams.get("user_id");
    const redirectUrl = searchParams.get("redirect_url");
    const workPlatformId = searchParams.get("work_platform_id");
    const environment = searchParams.get("environment") || "staging";

    useEffect(() => {
        if (!sdkLoaded || !token || !userId) return;

        try {
            setStatus("connecting");
            setMessage("TikTok bağlantısı başlatılıyor...");

            const config: any = {
                clientDisplayName: "Sesar",
                environment: environment,
                userId: userId,
                token: token,
                redirect: true,
                redirectURL: redirectUrl || window.location.origin + "/connect/tiktok/callback",
            };

            if (workPlatformId) {
                config.workPlatformId = workPlatformId;
            }

            console.log("[TikTok Connect] Initializing SDK with config:", { ...config, token: "***" });

            const phylloConnect = window.PhylloConnect.initialize(config);

            phylloConnect.on("accountConnected", (accountId: string, workplatformId: string, usrId: string) => {
                console.log(`[TikTok Connect] Account connected: ${accountId}`);
                setStatus("success");
                setMessage("Hesap başarıyla bağlandı!");
            });

            phylloConnect.on("accountDisconnected", (accountId: string, workplatformId: string, usrId: string) => {
                console.log(`[TikTok Connect] Account disconnected: ${accountId}`);
            });

            phylloConnect.on("tokenExpired", (usrId: string) => {
                console.log(`[TikTok Connect] Token expired`);
                setStatus("error");
                setMessage("Token süresi doldu. Lütfen tekrar deneyin.");
            });

            phylloConnect.on("exit", (reason: string, usrId: string) => {
                console.log(`[TikTok Connect] Exit: ${reason}`);
                if (status !== "success") {
                    // Redirect back to app with exit reason
                    if (redirectUrl) {
                        window.location.href = `${redirectUrl}?reason=${encodeURIComponent(reason)}`;
                    }
                }
            });

            phylloConnect.on("connectionFailure", (reason: string, workplatformId: string, usrId: string) => {
                console.log(`[TikTok Connect] Connection failure: ${reason}`);
                setStatus("error");
                setMessage(`Bağlantı başarısız: ${reason}`);
            });

            // Open the SDK
            phylloConnect.open();

        } catch (err) {
            console.error("[TikTok Connect] Error:", err);
            setStatus("error");
            setMessage("SDK başlatılamadı.");
        }
    }, [sdkLoaded, token, userId, redirectUrl, workPlatformId, environment, status]);

    if (!token || !userId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Hata</h1>
                    <p>Geçersiz parametreler. Token ve user_id gerekli.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Script
                src="https://cdn.getphyllo.com/connect/v2/phyllo-connect.js"
                onLoad={() => {
                    console.log("[TikTok Connect] SDK loaded");
                    setSdkLoaded(true);
                }}
                onError={() => {
                    console.error("[TikTok Connect] Failed to load SDK");
                    setStatus("error");
                    setMessage("SDK yüklenemedi.");
                }}
            />
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    {status === "loading" && (
                        <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                            <p>{message}</p>
                        </>
                    )}
                    {status === "connecting" && (
                        <>
                            <div className="animate-pulse">
                                <div className="h-12 w-12 bg-pink-500 rounded-full mx-auto mb-4"></div>
                            </div>
                            <p>{message}</p>
                        </>
                    )}
                    {status === "success" && (
                        <>
                            <div className="h-12 w-12 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p>{message}</p>
                        </>
                    )}
                    {status === "error" && (
                        <>
                            <div className="h-12 w-12 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p>{message}</p>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

export default function TikTokConnectPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        }>
            <TikTokConnectContent />
        </Suspense>
    );
}
