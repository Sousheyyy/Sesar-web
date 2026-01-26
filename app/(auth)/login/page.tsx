"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Music2, ArrowRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { UserRole } from "@prisma/client";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
      } else {
        toast.success("Giriş başarılı!");

        // Fetch user data from Prisma (via API or server component)
        // For now, we'll try to get the session and redirect based on role
        setTimeout(async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
              // We need to know the role. Since we don't have it in the JWT easily without custom claims,
              // we can fetch a minimal user profile from an API route.
              const profileResponse = await fetch("/api/user/profile");
              if (profileResponse.ok) {
                const profile = await profileResponse.json();
                if (profile?.role === UserRole.ADMIN) {
                  window.location.href = "/admin/analytics";
                } else if (profile?.role === UserRole.ARTIST) {
                  window.location.href = "/artist/campaigns";
                } else {
                  // CREATOR role - redirect to profile or wallet
                  window.location.href = "/profile";
                }
              } else {
                // Fallback if profile fetch fails
                window.location.href = "/profile";
              }
            } else {
              window.location.href = "/profile";
            }
          } catch (sessionError) {
            console.error("Failed to fetch session:", sessionError);
            window.location.href = "/profile";
          }
        }, 100);
      }
    } catch (error) {
      toast.error("Giriş sırasında bir hata oluştu");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#0A0A0B] text-white">
      {/* Left Side - Branding & Visuals */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-purple-600/20 blur-[150px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-pink-600/20 blur-[150px]" />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Music2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold">TikPay</span>
          </Link>

          <div className="space-y-6 max-w-lg">
            <h1 className="text-5xl font-bold leading-tight">
              Müziğin Gücünü <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Kazanca Dönüştür
              </span>
            </h1>
            <p className="text-xl text-zinc-400 leading-relaxed">
              Binlerce içerik üreticisi ve sanatçı arasına katıl. TikTok videolarınla viral ol ve gelir elde etmeye başla.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4 max-w-lg">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="font-medium">Hızlı Ödeme</span>
            </div>
            <p className="text-sm text-zinc-400">Onaylanan videolar için anında bakiye.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="font-medium">Viral Etki</span>
            </div>
            <p className="text-sm text-zinc-400">Şarkıları milyonlara ulaştır.</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0B] lg:bg-transparent">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Tekrar Hoş Geldin</h2>
            <p className="text-zinc-400">Hesabına giriş yap ve kaldığın yerden devam et.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300 ml-1">E-posta Adresi</Label>
              <Input
                id="email"
                type="email"
                placeholder="isim@ornek.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20 transition-all rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300 ml-1">Şifre</Label>
                <Link href="#" className="text-xs text-purple-400 hover:text-purple-300 hover:underline">
                  Şifremi unuttum?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20 transition-all rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Giriş Yapılıyor...
                </>
              ) : (
                <>
                  Giriş Yap
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0A0A0B] px-2 text-zinc-500">veya</span>
            </div>
          </div>

          <p className="text-center text-sm text-zinc-500">
            Henüz hesabın yok mu?{" "}
            <Link href="/register" className="font-medium text-purple-400 hover:text-purple-300 transition-colors">
              Hemen Kayıt Ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
