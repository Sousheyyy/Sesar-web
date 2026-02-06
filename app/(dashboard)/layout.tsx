import { requireAuth } from "@/lib/auth-utils";
import { Sidebar } from "@/components/dashboard/sidebar";
import { UserNav } from "@/components/dashboard/user-nav";
import { Bell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] text-white selection:bg-purple-500/30">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/5 blur-[120px]" />
      </div>

      <aside className="hidden w-72 lg:block z-20">
        <Sidebar role={user.role} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <header className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-[#0A0A0B]/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-medium text-white/90">
              <span className="text-zinc-500 font-normal mr-2">Merhaba,</span>
              {user.name || "Kullanıcı"}
            </h1>
            {user.role === 'CREATOR' && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/10 text-xs font-medium text-purple-300">
                <Sparkles className="w-3 h-3" />
                <span>Pro Üretici</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" className="relative text-zinc-400 hover:text-white hover:bg-white/5 rounded-full w-10 h-10 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 ring-2 ring-[#0A0A0B]" />
            </Button>
            <div className="h-6 w-px bg-white/10" />
            <UserNav user={{
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role
            }} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
