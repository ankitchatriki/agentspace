import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingIncludes: { '/api/connector/[file]': ['./connector/**'] },
};
export default nextConfig;
