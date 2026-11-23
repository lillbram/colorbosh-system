import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Payment-proof photos are posted to Server Actions (resized to well under 1 MB in the
    // browser, but the default 1 MB limit is too tight for large screenshots).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
