import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default Next.js output works on Vercel Serverless Functions — no `standalone`
  // needed unless self-hosting via Docker/Node.
  poweredByHeader: false,
};

export default nextConfig;
