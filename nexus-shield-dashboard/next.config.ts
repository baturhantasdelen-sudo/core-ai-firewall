import type { NextConfig } from 'next';

/** Standalone is for self-hosted/Docker; Vercel uses its own serverless output trace. */
const isVercel = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: 'standalone' as const }),
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  async headers() {
    return [
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
