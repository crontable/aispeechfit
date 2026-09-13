import { isKakaoTestEnabled, TEST_ORIGIN } from "../kakao-test/config.ts";

export function missingLocalAuthSettings(env = process.env) {
  return [
    "BETTER_AUTH_SECRET",
    "KAKAO_CLIENT_ID",
    "KAKAO_CLIENT_SECRET",
    "KAKAO_APP_ID",
    "AUTH_MIGRATION_DATABASE_URL",
  ].filter((key) => !env[key]?.trim());
}

export function getLocalAuthConfig(env = process.env) {
  if (!isKakaoTestEnabled(env))
    throw new Error("Local auth verification disabled");
  if (missingLocalAuthSettings(env).length)
    throw new Error("Local auth settings incomplete");
  if (env.BETTER_AUTH_SECRET!.length < 32 || !/^\d+$/.test(env.KAKAO_APP_ID!))
    throw new Error("Invalid auth settings");
  const url = new URL(env.AUTH_MIGRATION_DATABASE_URL!);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "55433" ||
    url.pathname !== "/auth_migration" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Only isolated local auth database is allowed");
  }
  return {
    baseURL: TEST_ORIGIN,
    databaseUrl: url.href,
    secret: env.BETTER_AUTH_SECRET!,
    clientId: env.KAKAO_CLIENT_ID!,
    clientSecret: env.KAKAO_CLIENT_SECRET!,
    appId: env.KAKAO_APP_ID!,
  };
}
