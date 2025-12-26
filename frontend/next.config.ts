import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/onchain-ai" : "",
  assetPrefix: isProd ? "/onchain-ai/" : "",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {},
};

export default nextConfig;
