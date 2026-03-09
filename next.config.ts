import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true,
  },
  env: {
    COMPANY_NAME: process.env.COMPANY_NAME || 'ForceFriction AI',
  },
};

export default nextConfig;
