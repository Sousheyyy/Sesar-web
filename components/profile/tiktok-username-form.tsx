"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Users,
  Video,
  Heart,
  UserCheck,
  Mail,
  Calendar
} from "lucide-react";
import type { TikTokUserProfile } from "@/lib/tiktok-scraper";

interface TikTokUsernameFormProps {
  currentTikTokHandle?: string | null;
  email?: string;
  createdAt?: Date;
}

export function TikTokUsernameForm({ currentTikTokHandle, email, createdAt }: TikTokUsernameFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState(currentTikTokHandle || "");
  const [isChecking, setIsChecking] = useState(false);
  const [profileData, setProfileData] = useState<TikTokUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Auto-load profile if TikTok handle exists
  useEffect(() => {
    if (currentTikTokHandle && !profileData && !isLoadingProfile) {
      loadProfile(currentTikTokHandle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTikTokHandle]);

  const loadProfile = async (handle: string) => {
    setIsLoadingProfile(true);
    setError(null);
    
    try {
      const response = await fetch("/api/user/profile/tiktok-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: handle,
          autoUpdate: false
        }),
      });

      const data = await response.json();

      if (response.ok && data.profile) {
        setProfileData(data.profile);
      }
    } catch (error) {
      // Silently fail on auto-load
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error("Lütfen bir TikTok kullanıcı adı girin");
      return;
    }

    setIsChecking(true);
    setError(null);
    setProfileData(null);

    try {
      const response = await fetch("/api/user/profile/tiktok-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: username.trim(),
          autoUpdate: true
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "TikTok kullanıcı adı kontrol edilemedi");
      }

      setProfileData(data.profile);
      toast.success("TikTok profili bulundu ve güncellendi!");
      router.refresh();
    } catch (error: any) {
      const errorMessage = error.message || "TikTok kullanıcı adı kontrol edilemedi";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>TikTok Profili</span>
          {currentTikTokHandle && (
            <Badge variant="secondary">Bağlı</Badge>
          )}
        </CardTitle>
        <CardDescription>
          TikTok kullanıcı adınızı girin ve profil bilgilerinizi görüntüleyin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Information */}
        {(email || createdAt) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
            {email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">E-posta</p>
                  <p className="text-sm">{email}</p>
                </div>
              </div>
            )}
            {createdAt && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Hesap Oluşturma Tarihi</p>
                  <p className="text-sm">
                    {new Date(createdAt).toLocaleDateString("tr-TR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleCheck} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tiktok-username">TikTok Kullanıcı Adı</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <Input
                  id="tiktok-username"
                  type="text"
                  placeholder="kullaniciadi"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/^@/, ""));
                    setError(null);
                    setProfileData(null);
                  }}
                  disabled={isChecking}
                  className="pl-8"
                />
              </div>
              <Button type="submit" disabled={isChecking || !username.trim()}>
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kontrol Ediliyor...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Kontrol Et ve Güncelle
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>

        {profileData && (
          <div className="rounded-lg border bg-muted/30 p-6 space-y-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage 
                  src={profileData.avatarLarger || profileData.avatar} 
                  alt={profileData.nickname}
                />
                <AvatarFallback>
                  {profileData.nickname.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-xl">@{profileData.uniqueId}</h3>
                  {profileData.isVerified && (
                    <Badge variant="default" className="gap-1">
                      <UserCheck className="h-3 w-3" />
                      Doğrulanmış
                    </Badge>
                  )}
                  {profileData.isPrivate && (
                    <Badge variant="outline">Özel</Badge>
                  )}
                </div>
                <p className="text-base font-medium text-muted-foreground">
                  {profileData.nickname}
                </p>
                {profileData.signature && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {profileData.signature}
                  </p>
                )}
                <a
                  href={`https://www.tiktok.com/@${profileData.uniqueId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  TikTok'ta Görüntüle
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Takipçi</span>
                </div>
                <p className="text-lg font-semibold">
                  {profileData.followerCount?.toLocaleString("tr-TR") || "0"}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Takip</span>
                </div>
                <p className="text-lg font-semibold">
                  {profileData.followingCount?.toLocaleString("tr-TR") || "0"}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Video className="h-4 w-4" />
                  <span className="text-xs">Video</span>
                </div>
                <p className="text-lg font-semibold">
                  {profileData.videoCount?.toLocaleString("tr-TR") || "0"}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">Beğeni</span>
                </div>
                <p className="text-lg font-semibold">
                  {profileData.heartCount?.toLocaleString("tr-TR") || "0"}
                </p>
              </div>
            </div>
          </div>
        )}

        {currentTikTokHandle && !profileData && !isLoadingProfile && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Mevcut TikTok kullanıcı adı: <span className="font-medium">@{currentTikTokHandle}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Profil bilgilerinizi görüntülemek için yukarıdaki butona tıklayın
            </p>
          </div>
        )}

        {isLoadingProfile && (
          <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm text-muted-foreground">Profil yükleniyor...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

