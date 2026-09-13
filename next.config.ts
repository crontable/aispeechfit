import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  // Public URLs only. Pin each build to its reviewed auth deployment.
  env: {
    AUTH_FUNCTION_URL: process.env.AUTH_FUNCTION_URL ?? '',
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? '',
    DEPLOY_URL: process.env.NETLIFY === 'true' ? process.env.DEPLOY_URL ?? '' : '',
  },
  logging: { incomingRequests: { ignore: [/\/api\/auth\/callback\/kakao/] } },
};

export default nextConfig;
