import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TikPay - TikTok İçerik Üretici Pazarı",
  description: "Müzik Sanatçılarını TikTok İçerik Üreticileri ile özgün şarkı tanıtımı için bir araya getirin",
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <head>
        {/* Polyfill esbuild's __name helper — OpenNext's esbuild bundler injects
            __name() calls into server-rendered inline scripts (e.g. next-themes)
            that execute before any external JS chunk loads. */}
        <script
          dangerouslySetInnerHTML={{
            __html: 'globalThis.__name=globalThis.__name||((t,v)=>Object.defineProperty(t,"name",{value:v,configurable:true}));',
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

