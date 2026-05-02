import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Disable React Compiler untuk dev yang lebih cepat
  reactCompiler: false,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Enable faster full page generation
    optimizePackageImports: ["react", "react-dom"],
  },
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
