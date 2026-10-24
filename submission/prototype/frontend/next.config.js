/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";
const backendUrl = process.env.BACKEND_URL;

if (isProduction && !backendUrl) {
  throw new Error(
    "BUILD ERROR: The BACKEND_URL environment variable is required in production (e.g. 'https://fedcreditx-api.onrender.com'). " +
      "Please configure BACKEND_URL in your Render dashboard environment variables so Next.js rewrites can proxy /api requests to the backend."
  );
}

const resolvedBackendUrl = backendUrl || "http://127.0.0.1:8000";

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${resolvedBackendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
