import type { NextConfig } from 'next';

/** Standalone is for self-hosted/Docker; Vercel uses its own serverless output trace. */
const isVercel = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: 'standalone' as const }),
  compress: true,
  poweredByHeader: false,
  /** Align with Cloudflare canonical URLs — avoid trailing-slash 308 loops. */
  trailingSlash: false,
  /**
   * When supported by the Next.js version, skip automatic trailing-slash redirects
   * so Cloudflare Edge handles canonical URL normalization (see docs/cloudflare-rules.md).
   */
  ...({ skipTrailingSlashRedirect: true } as Partial<NextConfig>),
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.nexusshield.ai' }],
        destination: 'https://nexusshield.ai/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path(favicon.ico|logo.png)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/:path(.*\\.png)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/:path(.*\\.svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/:path(.*\\.jpg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
