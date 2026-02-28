import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
