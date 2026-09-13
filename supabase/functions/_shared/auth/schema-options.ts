import type { BetterAuthOptions } from 'better-auth';

/** Shared by schema verification and the future production auth factory. */
export const authSchemaOptions = {
  user: {
    modelName: 'users',
    fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' },
  },
  account: {
    modelName: 'accounts',
    fields: {
      userId: 'user_id', providerId: 'provider_id', accountId: 'provider_account_id',
      accessToken: 'access_token', refreshToken: 'refresh_token', idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at', refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at', updatedAt: 'updated_at',
    },
    encryptOAuthTokens: true,
    accountLinking: { enabled: false },
  },
  session: {
    modelName: 'sessions',
    fields: {
      userId: 'user_id', expiresAt: 'expires_at', ipAddress: 'ip_address',
      userAgent: 'user_agent', createdAt: 'created_at', updatedAt: 'updated_at',
    },
    cookieCache: { enabled: false },
  },
  verification: {
    modelName: 'verifications',
    fields: { expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' },
  },
  advanced: { database: { generateId: 'uuid' } },
} satisfies BetterAuthOptions;
