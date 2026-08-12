import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/index.html",
      },
      {
        source: "/admin",
        destination: "/admin.html",
      },
      {
        source: "/leaderboard",
        destination: "/leaderboard.html",
      },
    ];
  },
};

export default nextConfig;
