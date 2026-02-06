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
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Exclude these packages from webpack bundling (they're server-only)
    serverComponentsExternalPackages: [
      'tiktok-scraper-ts',
      'playwright-core',
      'playwright-chromium',
      'chromium-bidi',
      'tiktok-signature',
      'electron',
    ],
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  // Disable ESLint during build to avoid compatibility issues with ESLint 9
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during build (optional, but helpful for Cloudflare)
  typescript: {
    ignoreBuildErrors: false,
  },
  // OpenNext-compatible output configuration
  output: 'standalone',
  // Generate static pages configuration - skip error pages static generation
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Exclude cache directories from build output for Cloudflare Pages
  // This prevents large cache files from being included in the deployment
  distDir: '.next',
  // Webpack config to exclude server-only packages from client bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Completely ignore these server-only modules on client side
      config.resolve.alias = {
        ...config.resolve.alias,
        'tiktok-scraper-ts': false,
        'playwright-core': false,
        'playwright-chromium': false,
        'chromium-bidi': false,
        'tiktok-signature': false,
      };
      
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        child_process: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
