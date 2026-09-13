// Hosting receives public settings only. Runtime secrets belong to Supabase.
if (process.env.NETLIFY === 'true') {
  const forbidden = ['AUTH_DATABASE_URL', 'AUTH_PHONE_DATABASE_URL', 'BETTER_AUTH_SECRET',
    'DATA_API_SIGNING_JWK', 'KAKAO_CLIENT_SECRET', 'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_DATA_SIGNING_JWK', 'SUPABASE_MIGRATION_SOURCE_DATABASE_URL'];
  const leaked = forbidden.filter(key => process.env[key]?.trim());
  const required = ['AUTH_FUNCTION_URL', 'BETTER_AUTH_URL', 'NEXT_PUBLIC_SUPABASE_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
  const missing = required.filter(key => !process.env[key]?.trim());
  if (missing.length || leaked.length) {
    if (missing.length) console.error('Missing public build settings: ' + missing.join(', '));
    if (leaked.length) console.error('Remove private settings from hosting: ' + leaked.join(', '));
    process.exitCode = 1;
  } else {
    console.log('Public service settings present; authentication secrets are not supplied to this build.');
  }
}
