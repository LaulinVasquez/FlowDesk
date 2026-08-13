import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent `next dev` and `next build` from sharing stale Webpack manifests.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
