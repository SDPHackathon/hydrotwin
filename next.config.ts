import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Tailwind loader also supports Webpack for production verification/fallback.
  webpack(config) {
    config.module.rules.push({ test: /globals\.css$/, use: ["@tailwindcss/turbopack"] });
    return config;
  },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
