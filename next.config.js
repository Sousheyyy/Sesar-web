/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn-us.com',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn-eu.com',
      },
      {
        protocol: 'https',
        hostname: '**.musical.ly',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  // Prisma must be externalized for OpenNext/Cloudflare Workers
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-avatar',
    ],
  },
  // Disable ETag to prevent 304 caching issues with RSC on Cloudflare CDN
  generateEtags: false,
  // Prevent Cloudflare CDN from caching dynamic responses
  async headers() {
    return [
      // RSC responses — never cache across deploys
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'rsc' }],
        headers: [
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      // API routes — never cache (prevents stale error pages)
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  distDir: '.next',
  // Silence Turbopack warning in Next.js 16 (turbopack handles fs/net/tls natively)
  turbopack: {},
  // Webpack config to exclude server-only packages from client bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
