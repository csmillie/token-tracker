import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large OTLP payloads
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
