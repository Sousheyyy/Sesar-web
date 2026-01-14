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
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
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
}

module.exports = nextConfig
