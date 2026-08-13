import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // A production build must never replace chunks used by a running dev server.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
