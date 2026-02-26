"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Music2,
  TrendingUp,
  Users,
  FileText,
  BarChart3,
  User,
  LayoutDashboard,
  Wallet,
  Landmark,
  MessageSquare,
  Send,
  Settings,
  LogOut,
  Activity,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  role: UserRole;
}

const navigation = {
  [UserRole.ADMIN]: [
    { name: "Analitik", href: "/admin/analytics", icon: BarChart3 },
    { name: "Kullanıcılar", href: "/admin/users", icon: Users },
    { name: "Kampanyalar", href: "/admin/campaigns", icon: Music2 },
    { name: "İşlemler", href: "/admin/transactions", icon: FileText },
    { name: "Banka", href: "/admin/bank", icon: Landmark },
    { name: "İzleme", href: "/admin/monitoring", icon: Activity },
    { name: "Ayarlar", href: "/admin/settings", icon: Settings },
    { name: "Profil", href: "/profile", icon: User },
  ],
  [UserRole.ARTIST]: [
    { name: "Ana Sayfa", href: "/artist", icon: LayoutDashboard },
    { name: "Şarkılarım", href: "/artist/songs", icon: Music2 },
    { name: "Kampanyalarım", href: "/artist/campaigns", icon: TrendingUp },
    { name: "Cüzdan", href: "/artist/wallet", icon: Wallet },
    { name: "Profil", href: "/profile", icon: User },
  ],
};

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = navigation[role] || navigation[UserRole.ARTIST];
  const homeLink = role === UserRole.ADMIN ? "/admin/analytics" : "/artist";

  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const [contactLoading, setContactLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      toast.error("Çıkış yapılırken bir hata oluştu");
      setLogoutLoading(false);
    }
  };

  const handleContact = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      toast.error("Lütfen konu ve mesaj alanlarını doldurun");
      return;
    }

    setContactLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed");
      }

      toast.success("Mesajınız başarıyla gönderildi!");
      setContactSubject("");
      setContactMessage("");
      setContactOpen(false);
    } catch {
      toast.error("Mesaj gönderilemedi, lütfen tekrar deneyin");
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col border-r border-white/5 bg-[#0A0A0B]/40 backdrop-blur-xl">
      <div className="p-8 pb-6">
        <Link href={homeLink} className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-50 blur transition-opacity" />
            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-colors">
              <Music2 className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              TikPay
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {links.map((link) => {
          const isActive = link.href === "/artist"
            ? pathname === "/artist"
            : (pathname === link.href || pathname?.startsWith(link.href + "/"));
          return (
            <Link key={link.href} href={link.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-12 text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-300",
                  isActive && "bg-white/5 text-white shadow-inner shadow-white/5 border border-white/5"
                )}
              >
                <link.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-purple-400" : "text-zinc-500 group-hover:text-purple-300")} />
                {link.name}
                {isActive && (
                  <div className="ml-auto w-1 h-1 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                )}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-2">
        <Dialog open={contactOpen} onOpenChange={setContactOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 text-zinc-400 hover:text-white hover:bg-white/5 h-12">
              <MessageSquare className="h-5 w-5 text-zinc-500" />
              Bize Ulaşın
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bize Ulaşın</DialogTitle>
              <DialogDescription>
                Sorularınızı ve önerilerinizi bize iletin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="sidebar-contact-subject">Konu</Label>
                <Input
                  id="sidebar-contact-subject"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="Mesajınızın konusu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidebar-contact-message">Mesaj</Label>
                <Textarea
                  id="sidebar-contact-message"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleContact}
                  disabled={!contactSubject.trim() || !contactMessage.trim() || contactLoading}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {contactLoading ? "Gönderiliyor..." : "Mesaj Gönder"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 h-12"
          onClick={handleLogout}
          disabled={logoutLoading}
        >
          <LogOut className="h-5 w-5 text-zinc-500" />
          {logoutLoading ? "Çıkış yapılıyor..." : "Çıkış Yap"}
        </Button>
      </div>
    </div>
  );
}
