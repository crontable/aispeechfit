import pg from 'pg';

// Inspect only catalog metadata and aggregate counts; never export user rows.
let client;
try {
  const value = process.env.SUPABASE_MIGRATION_SOURCE_DATABASE_URL;
  if (!value) throw new Error('SOURCE_DATABASE_URL_REQUIRED');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error('SOURCE_URL_MUST_HAVE_NO_QUERY');
  }
  client = new pg.Client({ connectionString: value,
    ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  await client.query('SET LOCAL row_security = off');
  const report = {};
  report.readOnly = (await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on';
  report.columns = (await client.query(`SELECT table_schema, table_name, column_name,
    data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' ORDER BY ordinal_position`)).rows;
  report.references = (await client.query(`SELECT conrelid::regclass::text AS relation,
    conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE contype = 'f' AND (confrelid = 'auth.users'::regclass
      OR conrelid = 'public.tickets'::regclass) ORDER BY conrelid, conname`)).rows;
  report.policies = (await client.query(`SELECT schemaname, tablename, policyname,
    permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('tickets', 'books', 'chapters', 'questions') ORDER BY tablename, policyname`)).rows;
  report.rls = (await client.query(`SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE relnamespace = 'public'::regnamespace
    AND relname IN ('tickets', 'books', 'chapters', 'questions') ORDER BY relname`)).rows;
  report.grants = (await client.query(`SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants WHERE table_schema = 'public'
    AND table_name IN ('tickets', 'books', 'chapters', 'questions')
    AND grantee IN ('anon', 'authenticated', 'service_role') ORDER BY table_name, grantee, privilege_type`)).rows;
  report.ticketFunction = (await client.query(`SELECT pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'has_active_ticket'`)).rows;
  report.counts = (await client.query(`SELECT
    (SELECT count(*) FROM auth.users) AS legacy_users,
    (SELECT count(*) FROM public.tickets) AS tickets,
    (SELECT count(DISTINCT user_id) FROM public.tickets) AS ticket_owners,
    (SELECT count(*) FROM public.tickets WHERE is_active AND started_at <= now() AND expires_at >= now()) AS active_tickets,
    (SELECT count(*) FROM public.tickets t LEFT JOIN auth.users u ON u.id = t.user_id WHERE u.id IS NULL) AS orphan_tickets,
    (SELECT count(*) FROM pg_namespace WHERE nspname = 'better_auth') AS better_auth_schema`)).rows[0];
  await client.query('COMMIT');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {});
  const known = ['SOURCE_DATABASE_URL_REQUIRED', 'SOURCE_URL_MUST_HAVE_NO_QUERY'];
  // Driver messages can contain secrets. Emit only standardized error codes.
  console.error(JSON.stringify({ error: known.includes(error.message) ? error.message : 'SOURCE_INSPECTION_FAILED',
    code: /^[A-Z0-9_]{3,50}$/.test(error.code ?? '') ? error.code : undefined }));
  process.exitCode = 1;
} finally {
  await client?.end();
}
