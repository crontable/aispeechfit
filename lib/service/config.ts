export function getServiceConfig(env: Record<string, string | undefined> = {
  NODE_ENV: process.env.NODE_ENV,
  EDGE_LOCAL_TEST: process.env.EDGE_LOCAL_TEST,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  AUTH_FUNCTION_URL: process.env.AUTH_FUNCTION_URL,
}) {
  const local = env.NODE_ENV !== 'production' && env.EDGE_LOCAL_TEST === 'true';
  const origin = new URL(env.BETTER_AUTH_URL ?? '');
  const functionUrl = new URL(env.AUTH_FUNCTION_URL ?? '');
  if (origin.origin !== env.BETTER_AUTH_URL || origin.username || origin.password
    || (!local && origin.protocol !== 'https:')
    || functionUrl.username || functionUrl.password || functionUrl.search || functionUrl.hash
    || (!local && (functionUrl.protocol !== 'https:' || !functionUrl.hostname.endsWith('.supabase.co')))
    || !/^\/functions\/v1\/[a-z0-9-]+$/.test(functionUrl.pathname)
    || (local && !['localhost', '127.0.0.1'].includes(functionUrl.hostname))) throw new Error('SERVICE_CONFIG_INVALID');
  return { origin: origin.origin, functionUrl: functionUrl.href };
}
