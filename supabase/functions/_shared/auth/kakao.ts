import { betterAuth } from "better-auth";
import type { Pool } from "pg";
import { authSchemaOptions } from "./schema-options.ts";

export type KakaoAuthConfig = {
  secret: string;
  clientId: string;
  clientSecret: string;
  baseURL: string;
};

export function createKakaoAuth(pool: Pool, config: KakaoAuthConfig) {
  return betterAuth({
    ...authSchemaOptions,
    appName: "AI 스피치핏",
    database: pool,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    socialProviders: {
      kakao: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        disableDefaultScope: true,
        scope: ["account_email", "profile_nickname", "phone_number"],
      },
    },
    session: { ...authSchemaOptions.session, expiresIn: 60 * 60 },
    advanced: {
      ...authSchemaOptions.advanced,
      cookiePrefix: "aispeechfit-better-auth",
      ipAddress: { disableIpTracking: true },
    },
    disabledPaths: [
      "/get-access-token",
      "/refresh-token",
      "/account-info",
      "/link-social",
      "/unlink-account",
    ],
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

export type KakaoAuth = ReturnType<typeof createKakaoAuth>;
