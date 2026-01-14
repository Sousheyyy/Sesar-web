"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Music2,
  TrendingUp,
  Wallet,
  Settings,
  Users,
  FileText,
  BarChart3,
  Upload,
  CheckCircle2,
  User,
  LogOut,
  Sparkles
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface SidebarProps {
  role: UserRole;
}

const navigation = {
  [UserRole.ADMIN]: [
    { name: "Analitik", href: "/admin/analytics", icon: BarChart3 },
    { name: "Kullanıcılar", href: "/admin/users", icon: Users },
    { name: "Kampanyalar", href: "/admin/campaigns", icon: Music2 },
    { name: "İşlemler", href: "/admin/transactions", icon: FileText },
    { name: "Pazar Yeri", href: "/dashboard/marketplace", icon: TrendingUp },
    { name: "Profil", href: "/profile", icon: User },
  ],
  [UserRole.ARTIST]: [
    { name: "Panel", href: "/dashboard", icon: LayoutDashboard },
    { name: "Şarkılarım", href: "/artist/songs", icon: Music2 },
    { name: "Kampanyalarım", href: "/artist/campaigns", icon: TrendingUp },
    { name: "Cüzdan", href: "/wallet", icon: Wallet },
    { name: "Pazar Yeri", href: "/dashboard/marketplace", icon: TrendingUp },
    { name: "Profil", href: "/profile", icon: User },
  ],
  [UserRole.CREATOR]: [
    { name: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard },
    { name: "Pazar Yeri", href: "/dashboard/marketplace", icon: Music2 },
    { name: "Gönderilerim", href: "/dashboard/submissions", icon: CheckCircle2 },
    { name: "Cüzdanım", href: "/wallet", icon: Wallet },
    { name: "Profilim", href: "/profile", icon: User },
  ],
};

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = navigation[role] || navigation[UserRole.CREATOR];

  return (
    <div className="flex h-full flex-col border-r border-white/5 bg-[#0A0A0B]/40 backdrop-blur-xl">
      <div className="p-8 pb-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
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
          const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
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

      <div className="p-4 mt-auto">
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-white/5 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">Pro İpuçları</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Daha fazla kazanmak için viral müzikleri takip edin.
          </p>
        </div>

        <Link href="/profile">
          <Button variant="ghost" className="w-full justify-start gap-3 text-zinc-400 hover:text-white hover:bg-white/5 h-12">
            <Settings className="h-5 w-5 text-zinc-500" />
            Ayarlar
          </Button>
        </Link>
      </div>
    </div>
  );
}
