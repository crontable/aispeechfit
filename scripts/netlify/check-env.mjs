// Hosting receives public settings only. Runtime secrets belong to Supabase.
if (process.env.NETLIFY === 'true') {
  const forbidden = ['AUTH_DATABASE_URL', 'AUTH_PHONE_DATABASE_URL', 'BETTER_AUTH_SECRET',
    'DATA_API_SIGNING_JWK', 'KAKAO_CLIENT_SECRET', 'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_DATA_SIGNING_JWK', 'SUPABASE_MIGRATION_SOURCE_DATABASE_URL'];
  const leaked = forbidden.filter(key => process.env[key]?.trim());
  const required = ['AUTH_FUNCTION_URL', 'BETTER_AUTH_URL', 'NEXT_PUBLIC_SUPABASE_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
  const missing = required.filter(key => !process.env[key]?.trim());
  const wrongPreviewOrigin = process.env.CONTEXT === 'deploy-preview'
    && process.env.BETTER_AUTH_URL !== process.env.DEPLOY_PRIME_URL;
  if (missing.length || leaked.length || wrongPreviewOrigin) {
    if (missing.length) console.error('Missing public build settings: ' + missing.join(', '));
    if (leaked.length) console.error('Remove private settings from hosting: ' + leaked.join(', '));
    if (wrongPreviewOrigin) console.error('BETTER_AUTH_URL must match this preview DEPLOY_PRIME_URL.');
    process.exitCode = 1;
  } else {
    console.log('Public service settings present; authentication secrets are not supplied to this build.');
  }
}
