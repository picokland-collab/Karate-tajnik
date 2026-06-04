import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // bwip-js/node uses Node.js built-ins (zlib, Buffer). Mark it external so
  // Vercel's bundler doesn't try to statically analyse it during the build.
  serverExternalPackages: ['bwip-js'],
};

export default nextConfig;
