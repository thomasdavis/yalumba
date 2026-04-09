import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config) => {
    config.watchOptions = { ...config.watchOptions, ignored: ["**/latex/**"] };
    return config;
  },
};

export default nextConfig;
