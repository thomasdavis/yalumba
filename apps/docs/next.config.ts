import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/yalumba",
  images: { unoptimized: true },
  webpack: (config) => {
    config.watchOptions = { ...config.watchOptions, ignored: ["**/latex/**"] };
    return config;
  },
};

export default nextConfig;
