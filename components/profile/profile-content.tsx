"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Save,
  KeyRound,
  Mail,
  ChevronRight,
  Loader2,
  User,
  Shield,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ProfileUser {
  id: string;
  name: string | null;
  email: string;
  bio: string | null;
  tiktokHandle: string | null;
  instagramHandle: string | null;
  youtubeHandle: string | null;
  role: string;
  balance: number;
  createdAt: string;
}

interface ProfileContentProps {
  user: ProfileUser;
}

export function ProfileContent({ user }: ProfileContentProps) {
  const [name, setName] = useState(user.name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [tiktokHandle, setTiktokHandle] = useState(user.tiktokHandle ?? "");
  const [instagramHandle, setInstagramHandle] = useState(user.instagramHandle ?? "");
  const [youtubeHandle, setYoutubeHandle] = useState(user.youtubeHandle ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Ad Soyad boş bırakılamaz");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim() || null,
          tiktokHandle: tiktokHandle.trim() || null,
          instagramHandle: instagramHandle.trim() || null,
          youtubeHandle: youtubeHandle.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Profil güncellenemedi");
      }

      toast.success("Profil başarıyla güncellendi");
    } catch (error: any) {
      toast.error(error.message || "Profil güncellenemedi");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    setIsResetting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
      });

      if (error) throw error;

      toast.success("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi");
    } catch (error: any) {
      toast.error(error.message || "Şifre sıfırlama bağlantısı gönderilemedi");
    } finally {
      setIsResetting(false);
    }
  };

  const roleLabel: Record<string, string> = {
    ADMIN: "Yönetici",
    ARTIST: "Sanatçı",
    CREATOR: "İçerik Üretici",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profil Ayarları</h2>
        <p className="text-muted-foreground mt-1">
          Hesap bilgilerinizi görüntüleyin ve düzenleyin
        </p>
      </div>

      {/* Profil Bilgileri */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-400" />
            <CardTitle>Profil Bilgileri</CardTitle>
          </div>
          <CardDescription>Kişisel bilgilerinizi güncelleyin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Ad Soyad</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınızı girin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="opacity-60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Biyografi</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Kendinizden bahsedin..."
              rows={3}
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tiktok">TikTok</Label>
              <Input
                id="tiktok"
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="kullaniciadi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="kullaniciadi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube">YouTube</Label>
              <Input
                id="youtube"
                value={youtubeHandle}
                onChange={(e) => setYoutubeHandle(e.target.value)}
                placeholder="kanal adi"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Değişiklikleri Kaydet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Güvenlik & Hesap */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-400" />
            <CardTitle>Güvenlik & Hesap</CardTitle>
          </div>
          <CardDescription>Şifre ve hesap bilgilerinizi yönetin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Şifre Sıfırla</p>
              </div>
              <p className="text-sm text-muted-foreground">
                E-posta adresinize şifre sıfırlama bağlantısı gönderilecektir
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePasswordReset}
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Bağlantı Gönder
            </Button>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Üyelik Tarihi</p>
              <p className="font-medium">{formatDate(user.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Hesap Türü</p>
              <Badge variant="secondary">
                {roleLabel[user.role] || user.role}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Bakiye</p>
              <p className="font-medium">{formatCurrency(user.balance)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yasal */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            <CardTitle>Yasal</CardTitle>
          </div>
          <CardDescription>Kullanım koşulları ve gizlilik politikası</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <Link
            href="/terms"
            className="flex items-center justify-between rounded-lg p-3 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium">Kullanım Koşulları</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/privacy"
            className="flex items-center justify-between rounded-lg p-3 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium">Gizlilik Politikası</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
