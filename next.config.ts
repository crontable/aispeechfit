import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  // These two values are public. Pin each build to its reviewed auth deployment.
  env: {
    AUTH_FUNCTION_URL: process.env.AUTH_FUNCTION_URL ?? '',
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? '',
  },
  logging: { incomingRequests: { ignore: [/\/api\/auth\/callback\/kakao/] } },
};

export default nextConfig;
