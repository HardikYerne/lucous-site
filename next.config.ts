import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    // In local development, proxy /api requests to the Express backend.
    // On Vercel, vercel.json handles routing /api to backend/vercel.js.
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

