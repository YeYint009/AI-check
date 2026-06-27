import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },  
    serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
};

export default nextConfig;
