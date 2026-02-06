"use client";

import { useState, useEffect, useCallback } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

// Declare PhylloConnect on window
declare global {
    interface Window {
        PhylloConnect?: {
            initialize: (config: {
                clientDisplayName: string;
                environment: 'sandbox' | 'staging' | 'production';
                userId: string;
                token: string;
                singleAccount?: boolean;
                redirect?: boolean;
                redirectURL?: string;
                workPlatformId?: string;
            }) => {
                open: () => void;
                on: (event: string, callback: (...args: any[]) => void) => void;
            };
            version: () => { connect_web_sdk_version: string };
        };
    }
}

export function TikTokConnect() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [sdkReady, setSdkReady] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{
        connected: boolean;
        user?: {
            username: string;
            displayName: string;
            avatarUrl: string;
        };
    } | null>(null);

    // Check for success/error params from OAuth callback (legacy support)
    useEffect(() => {
        if (searchParams.get("success") === "tiktok_connected") {
            toast.success("TikTok hesabı başarıyla bağlandı!");
            router.replace("/profile");
            checkStatus();
        } else if (searchParams.get("error") === "tiktok_connection_failed") {
            toast.error("TikTok bağlantısı başarısız oldu");
        } else if (searchParams.get("error")) {
            const errorDetails = searchParams.get("details");
            toast.error(errorDetails || "TikTok bağlantısı başarısız oldu");
        }
    }, [searchParams, router]);

    // Process accounts connected via Phyllo SDK events
    const processConnectedAccounts = async (userId: string, accounts: Array<{ account_id: string; work_platform_id: string }>) => {
        try {
            console.log('[Phyllo] Processing connected accounts:', { userId, accounts });
            const response = await fetch("/api/auth/insightiq/process-connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, accounts }),
            });
            
            if (response.ok) {
                toast.success("TikTok hesabı başarıyla bağlandı!");
                checkStatus();
            } else {
                const error = await response.json();
                console.error('[Phyllo] Process connection error:', error);
                toast.error("Bağlantı işlenirken hata oluştu");
            }
        } catch (error) {
            console.error('[Phyllo] Failed to process connection:', error);
            toast.error("Bağlantı işlenirken hata oluştu");
        }
    };

    // Check connection status on mount
    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const response = await fetch("/api/auth/insightiq/status");
            const data = await response.json();

            if (data.success) {
                setConnectionStatus({
                    connected: data.connected,
                    user: data.user,
                });
            }
        } catch (error) {
            console.error("Status check failed:", error);
        } finally {
            setIsChecking(false);
        }
    };

    // Handle SDK load
    const handleSdkLoad = useCallback(() => {
        console.log('[Phyllo] SDK loaded successfully');
        if (window.PhylloConnect) {
            console.log('[Phyllo] SDK version:', window.PhylloConnect.version());
            setSdkReady(true);
        }
    }, []);

    const handleSdkError = useCallback((e: any) => {
        console.error('[Phyllo] SDK failed to load:', e);
        toast.error("Bağlantı SDK'sı yüklenemedi");
    }, []);

    // Use Phyllo Connect SDK with popup flow (recommended for web)
    const handleConnect = async () => {
        setIsLoading(true);
        try {
            console.log('[Phyllo] Starting connection flow (popup)...');

            // Check if SDK is loaded
            if (!window.PhylloConnect) {
                throw new Error("Phyllo SDK henüz yüklenmedi. Lütfen sayfayı yenileyin.");
            }

            // Get SDK token and config from backend
            const response = await fetch("/api/auth/insightiq/initiate", {
                method: "POST",
            });
            const data = await response.json();

            console.log('[Phyllo] Backend response:', data);

            if (!data.success) {
                throw new Error(data.message || data.error || "Bağlantı başlatılamadı");
            }

            // Determine environment from backend
            const environment = data.environment || 'staging';

            // Initialize Phyllo Connect SDK with POPUP flow (not redirect)
            const config: Parameters<typeof window.PhylloConnect.initialize>[0] = {
                clientDisplayName: 'Sesar',
                environment: environment as 'sandbox' | 'staging' | 'production',
                userId: data.userId,
                token: data.token,
                singleAccount: false,
                redirect: false, // POPUP FLOW - not redirect
                workPlatformId: data.workPlatformId, // TikTok platform ID to skip selection
            };

            console.log('[Phyllo] Initializing SDK with config:', { ...config, token: '***' });

            const phylloConnect = window.PhylloConnect.initialize(config);
            
            // Set up event handlers for popup flow
            phylloConnect.on('accountConnected', (accountId: string, workPlatformId: string, userId: string) => {
                console.log('[Phyllo] Account connected:', { accountId, workPlatformId, userId });
                // Process the connected account
                processConnectedAccounts(userId, [{ account_id: accountId, work_platform_id: workPlatformId }]);
            });

            phylloConnect.on('accountDisconnected', (accountId: string, workPlatformId: string, userId: string) => {
                console.log('[Phyllo] Account disconnected:', { accountId, workPlatformId, userId });
                toast.info("Hesap bağlantısı kesildi");
                checkStatus();
            });

            phylloConnect.on('tokenExpired', (userId: string) => {
                console.log('[Phyllo] Token expired for user:', userId);
                toast.error("Oturum süresi doldu. Lütfen tekrar deneyin.");
                setIsLoading(false);
            });

            phylloConnect.on('exit', (reason: string, userId: string) => {
                console.log('[Phyllo] SDK exited:', { reason, userId });
                setIsLoading(false);
                
                // Show message based on exit reason
                if (reason === 'DONE_CLICKED') {
                    // User clicked done - check if connection was successful
                    checkStatus();
                } else if (reason === 'TOKEN_EXPIRED') {
                    toast.error("Oturum süresi doldu");
                } else {
                    // User closed the popup
                    console.log('[Phyllo] User closed the popup:', reason);
                }
            });

            phylloConnect.on('connectionFailure', (reason: string, workPlatformId: string, userId: string) => {
                console.log('[Phyllo] Connection failed:', { reason, workPlatformId, userId });
                toast.error(`Bağlantı başarısız: ${reason}`);
            });

            console.log('[Phyllo] Opening SDK popup...');
            phylloConnect.open();

        } catch (error: any) {
            console.error('[Phyllo] Connection error:', error);
            toast.error(error.message || "Bir hata oluştu");
            setIsLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("TikTok hesabınızın bağlantısını kesmek istediğinize emin misiniz?")) return;

        setIsLoading(true);
        try {
            const response = await fetch("/api/auth/insightiq/disconnect", {
                method: "POST",
            });

            if (response.ok) {
                setConnectionStatus({ connected: false });
                toast.success("Bağlantı kesildi");
                router.refresh();
            } else {
                throw new Error("Bağlantı kesilemedi");
            }
        } catch (error) {
            toast.error("Bir hata oluştu");
        } finally {
            setIsLoading(false);
        }
    };

    if (isChecking) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* Load Phyllo Connect SDK */}
            <Script
                src="https://cdn.getphyllo.com/connect/v2/phyllo-connect.js"
                strategy="afterInteractive"
                onLoad={handleSdkLoad}
                onError={handleSdkError}
            />
            
            <Card>
                <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>TikTok Bağlantısı</CardTitle>
                        <CardDescription>
                            Kampanyalar oluşturmak ve şarkılarınızı yönetmek için TikTok hesabınızı bağlayın
                        </CardDescription>
                    </div>
                    {connectionStatus?.connected && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Bağlı
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {connectionStatus?.connected ? (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-4">
                            {connectionStatus.user?.avatarUrl ? (
                                <img
                                    src={connectionStatus.user.avatarUrl}
                                    alt="Avatar"
                                    className="h-12 w-12 rounded-full border"
                                />
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                                    <span className="text-xl font-bold text-slate-500">
                                        {connectionStatus.user?.displayName?.charAt(0) || "T"}
                                    </span>
                                </div>
                            )}
                            <div>
                                <p className="font-semibold">{connectionStatus.user?.displayName}</p>
                                <p className="text-sm text-muted-foreground">@{connectionStatus.user?.username}</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={handleDisconnect}
                            disabled={isLoading}
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Bağlantıyı Kes
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 text-sm text-amber-600 bg-amber-50 rounded-md border border-amber-200">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <p>Şarkılarınızı otomatik olarak doğrulamak için hesabınızı bağlamanız gerekmektedir.</p>
                        </div>

                        <Button
                            className="w-full bg-black hover:bg-black/90 text-white gap-2"
                            onClick={handleConnect}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Bağlanıyor...
                                </>
                            ) : (
                                <>
                                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                                    </svg>
                                    TikTok ile Bağlan
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
        </>
    );
}
