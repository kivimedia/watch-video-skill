import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cutsense/core', '@cutsense/storage'],
};

export default nextConfig;
