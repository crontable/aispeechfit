// Build-time validation only. Server credentials belong to the Functions scope.
if (process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production') {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_KEY'];
  const missing = required.filter(key => !process.env[key]?.trim());
  if (missing.length) {
    console.error('Missing public build settings: ' + missing.join(', '));
    process.exitCode = 1;
  } else {
    console.log('Public build settings present. Runtime authentication is verified separately.');
  }
}
