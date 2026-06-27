import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },  
    serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
      outputFileTracingIncludes: {
    '/api/run-screenshot-batch': [
      './node_modules/playwright-core/**/*',
      './node_modules/@sparticuz/chromium/**/*',
    ],
  },
};

export default nextConfig;
