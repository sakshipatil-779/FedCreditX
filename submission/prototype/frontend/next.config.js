/** @type {import('next').NextConfig} */
function getNormalizedBackendUrl() {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  const rawBackendUrl = process.env.BACKEND_URL;
  let normalized = rawBackendUrl ? rawBackendUrl.trim() : "";
  if (normalized) {
    normalized = normalized.replace(/\/+$/, "");
  }

  function isValidHttpUrl(str) {
    try {
      const parsed = new URL(str);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  if (isProduction) {
    if (!normalized) {
      throw new Error(
        "BUILD ERROR: The BACKEND_URL environment variable is required in production (e.g. 'https://fedcreditx-api.onrender.com'). " +
          "Please configure BACKEND_URL in your Render dashboard environment variables so Next.js rewrites can proxy /api requests to the backend."
      );
    }
    if (!isValidHttpUrl(normalized)) {
      throw new Error(
        `BUILD ERROR: The BACKEND_URL environment variable must be a valid absolute HTTP or HTTPS URL (e.g. 'https://fedcreditx-api.onrender.com'), received: '${normalized}'. ` +
          "Please configure a valid BACKEND_URL in your Render dashboard environment variables."
      );
    }
  } else {
    if (!normalized || !isValidHttpUrl(normalized)) {
      console.warn(
        `[next.config.js] WARNING: BACKEND_URL is not set or invalid (${normalized || "unset"}). Falling back to local development server: http://localhost:8000`
      );
      normalized = "http://localhost:8000";
    }
  }

  const backendOrigin = new URL(normalized).origin;
  console.log(`Proxying /api to ${backendOrigin}`);
  return normalized;
}

const resolvedBackendUrl = getNormalizedBackendUrl();

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
