import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Music2, TrendingUp, Wallet, Sparkles, ArrowRight, Star, ShieldCheck, Zap, PlayCircle } from "lucide-react";

// Force dynamic rendering for Cloudflare Pages
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-purple-500/30 overflow-hidden relative">
      {/* Background Elements - More Vibrant & Alive */}
      <div className="fixed inset-0 -z-10">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] mask-gradient-to-b" />

        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/20 blur-[130px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-pink-600/20 blur-[130px] animate-pulse delay-1000" />
        <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] animate-pulse delay-700" />
        <div className="absolute bottom-[20%] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px] animate-pulse delay-500" />

        {/* Radial Gradient Overlay for Depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020617_100%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/70 backdrop-blur-xl supports-[backdrop-filter]:bg-[#020617]/60">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full opacity-20 group-hover:opacity-40 blur-lg transition-opacity duration-500" />
              <div className="relative flex items-center justify-center p-2 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10">
                <Music2 className="h-6 w-6 text-white transition-transform group-hover:scale-110" />
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              TikPay
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="hidden sm:block">
              <span className="text-sm font-medium text-zinc-400 transition-colors hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                Giriş Yap
              </span>
            </Link>
            <Link href="/register">
              <Button
                className="bg-white text-black hover:bg-zinc-100 font-semibold rounded-full px-6 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
              >
                Hemen Başla
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 lg:pt-40 lg:pb-48 px-4">
          <div className="container mx-auto max-w-5xl text-center relative z-10">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/20 bg-purple-500/10 mb-8 animate-fade-in backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-200">İçerik Üreticileri İçin Yeni Dönem</span>
            </div>

            <h1 className="mb-8 text-5xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl leading-[1.1] drop-shadow-2xl">
              TikTok Videolarını{" "}
              <br className="hidden sm:block" />
              <span className="relative inline-block">
                <span className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 blur-[30px] opacity-30 animate-pulse" />
                <span className="relative bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                  Gelire Dönüştür
                </span>
              </span>
            </h1>

            <p className="mb-12 text-lg text-zinc-300 sm:text-xl lg:text-2xl max-w-3xl mx-auto leading-relaxed drop-shadow-lg">
              Popüler şarkılarla yaratıcı videolar çek, izlenmeye göre anında kazan.
              <span className="text-white font-medium"> Sadece içerik üreterek</span> düzenli gelir elde etmenin en modern yolu.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-200">
              <Link href="/register" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-16 w-full sm:w-auto gap-3 bg-gradient-to-r from-purple-600 to-pink-600 px-10 text-xl font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] rounded-full border border-white/10"
                >
                  Ücretsiz Başla
                  <ArrowRight className="h-6 w-6" />
                </Button>
              </Link>
            </div>

            {/* Stats Mockup */}
            <div className="mt-24 pt-10 border-t border-white/5 bg-white/[0.02] backdrop-blur-sm rounded-3xl p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { label: "Aktif Üretici", value: "500+" },
                { label: "Ödenen Tutar", value: "₺250K+" },
                { label: "Kampanyalar", value: "100+" },
                { label: "Ort. Kazanç", value: "₺7.500" },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center group cursor-default">
                  <span className="text-3xl font-bold text-white mb-2 group-hover:scale-110 transition-transform duration-300 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">{stat.value}</span>
                  <span className="text-sm font-medium text-zinc-500 group-hover:text-purple-400 transition-colors">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 px-4 relative">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Neden TikPay?</h2>
              <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
                Sadece video çekerek değil, doğru müzikleri kullanarak da kazanmaya başla.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group p-8 rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:bg-white/[0.05] hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-2 box-hover-glow">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                  <Zap className="h-7 w-7 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">Hızlı Ödeme</h3>
                <p className="text-zinc-400 leading-relaxed text-lg">
                  Onaylanan videoların için ödemelerini hızlıca al. Beklemek yok, kazancın anında cüzdanında.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group p-8 rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:bg-white/[0.05] hover:border-pink-500/30 transition-all duration-500 hover:-translate-y-2 box-hover-glow">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]">
                  <TrendingUp className="h-7 w-7 text-pink-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-pink-300 transition-colors">Viral Müzikler</h3>
                <p className="text-zinc-400 leading-relaxed text-lg">
                  En trend şarkılara erken eriş. Videoların keşfete düşme şansını artırırken para kazan.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group p-8 rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all duration-500 hover:-translate-y-2 box-hover-glow">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <ShieldCheck className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors">Güvenilir Sistem</h3>
                <p className="text-zinc-400 leading-relaxed text-lg">
                  Şeffaf sayım ve raporlama. Her izlenme ve etkileşim anlık olarak kayıt altında.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent pointer-events-none" />
          <div className="container mx-auto max-w-5xl relative z-10">
            <div className="rounded-[3rem] border border-white/10 bg-[#0A0A0B]/80 backdrop-blur-3xl p-12 lg:p-24 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Hemen Başlamaya Hazır Mısın?</h2>
              <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
                Hesabını oluştur, şarkını seç, videonu yükle ve kazanmaya başla.
              </p>

              <Link href="/register">
                <Button size="lg" className="h-16 px-12 rounded-full text-lg font-bold bg-white text-black hover:bg-zinc-100 hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                  Ücretsiz Kayıt Ol
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Artist CTA Section (Subtle) */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="inline-block p-px rounded-full bg-gradient-to-r from-white/5 to-white/10 hover:from-purple-500/20 hover:to-pink-500/20 transition-colors duration-300">
              <div className="bg-[#020617] rounded-full px-8 py-3 flex items-center gap-4">
                <span className="text-zinc-400">Müziğinizi tanıtmak mı istiyorsunuz?</span>
                <Link href="mailto:contact@tikpay.app" className="text-white hover:text-purple-400 font-medium transition-colors">
                  Sanatçı Olarak İletişime Geç →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020617] py-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Music2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">TikPay</span>
          </div>
          <p className="text-sm text-zinc-500">
            &copy; 2025 TikPay. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}
