import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  logging: { incomingRequests: { ignore: [/\/api\/auth\/callback\/kakao/] } },
};

export default nextConfig;
