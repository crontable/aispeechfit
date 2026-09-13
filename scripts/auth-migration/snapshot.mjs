import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const tables = ['auth.users', 'auth.identities', 'public.tickets'];

export function stagingConfig(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.port !== '55433' || url.pathname !== '/auth_migration'
    || url.search || url.hash) throw new Error('INVALID_STAGING_DATABASE');
  return { connectionString: value, connectionTimeoutMillis: 10000 };
}

// JSON text stays in PostgreSQL form: no JS number/date conversion or field selection.
export async function snapshot(source, target) {
  const runId = randomUUID();
  const counts = {};
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    // Fail instead of silently exporting an RLS-filtered subset.
    await source.query('SET LOCAL row_security = off');
    await source.query("SET LOCAL statement_timeout = '60s'");
    await target.query('BEGIN');
    await target.query('CREATE SCHEMA IF NOT EXISTS auth_source');
    await target.query('REVOKE ALL ON SCHEMA auth_source FROM PUBLIC');
    await target.query(`CREATE TABLE IF NOT EXISTS auth_source.snapshots (
      id uuid PRIMARY KEY, captured_at timestamptz NOT NULL,
      catalog text NOT NULL, manifest jsonb NOT NULL)`);
    await target.query(`CREATE TABLE IF NOT EXISTS auth_source.rows (
      snapshot_id uuid NOT NULL REFERENCES auth_source.snapshots(id),
      source_table text NOT NULL, ordinal bigint NOT NULL, payload text NOT NULL,
      PRIMARY KEY (snapshot_id, source_table, ordinal))`);
    await target.query('REVOKE ALL ON ALL TABLES IN SCHEMA auth_source FROM PUBLIC');
    const catalog = await source.query(`SELECT json_build_object(
      'columns', (SELECT json_agg(c ORDER BY table_schema, table_name, ordinal_position)
        FROM information_schema.columns c
        WHERE table_schema || '.' || table_name = ANY($1::text[])),
      'constraints', (SELECT json_agg(c) FROM (
        SELECT conrelid::regclass::text AS relation, conname, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint WHERE conrelid = ANY($1::regclass[])
        ORDER BY conrelid, conname) c))::text AS payload`, [tables]);
    const time = await source.query('SELECT transaction_timestamp()::text AS value');
    await target.query(`INSERT INTO auth_source.snapshots VALUES ($1, $2, $3, '{}')`,
      [runId, time.rows[0].value, catalog.rows[0].payload]);
    const manifest = {};
    for (const table of tables) {
      // Identifiers come exclusively from the fixed allowlist above.
      await source.query(`DECLARE export_rows NO SCROLL CURSOR FOR
        SELECT row_to_json(t)::text AS payload FROM ${table} t ORDER BY id`);
      let count = 0;
      const digest = createHash('sha256');
      for (;;) {
        const batch = await source.query('FETCH FORWARD 250 FROM export_rows');
        if (!batch.rows.length) break;
        const payloads = batch.rows.map(({ payload }) => payload);
        for (const payload of payloads) digest.update(payload).update('\n');
        await target.query(`INSERT INTO auth_source.rows
          SELECT $1, $2, $3::bigint + ord, payload
          FROM unnest($4::text[]) WITH ORDINALITY AS batch(payload, ord)`,
        [runId, table, count, payloads]);
        count += payloads.length;
      }
      await source.query('CLOSE export_rows');
      const expected = digest.digest('hex');
      // Read back stored bytes in bounded batches before accepting the snapshot.
      const actual = createHash('sha256');
      let readCount = 0;
      for (;;) {
        const batch = await target.query(`SELECT payload FROM auth_source.rows
          WHERE snapshot_id = $1 AND source_table = $2 AND ordinal > $3
          ORDER BY ordinal LIMIT 250`, [runId, table, readCount]);
        if (!batch.rows.length) break;
        for (const { payload } of batch.rows) actual.update(payload).update('\n');
        readCount += batch.rows.length;
      }
      if (count !== readCount || expected !== actual.digest('hex')) throw new Error('SNAPSHOT_MISMATCH');
      counts[table] = count;
      manifest[table] = { count, sha256: expected };
    }
    await target.query('UPDATE auth_source.snapshots SET manifest = $2 WHERE id = $1', [runId, manifest]);
    await source.query('COMMIT');
    await target.query('COMMIT');
    return { snapshotId: runId, counts, verified: true };
  } catch (error) {
    await Promise.allSettled([source.query('ROLLBACK'), target.query('ROLLBACK')]);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let source;
  let target;
  try {
    const sourceUrl = process.env.SUPABASE_MIGRATION_SOURCE_DATABASE_URL;
    if (!sourceUrl) throw new Error('SOURCE_DATABASE_URL_REQUIRED');
    target = new pg.Client(stagingConfig(process.env.AUTH_MIGRATION_DATABASE_URL));
    // TLS with certificate verification is mandatory for the remote source.
    source = new pg.Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 10000 });
    const parsed = new URL(sourceUrl);
    if (parsed.search || parsed.hash || !['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('SOURCE_URL_MUST_HAVE_NO_QUERY');
    }
    await source.connect();
    await target.connect();
    console.log(JSON.stringify(await snapshot(source, target)));
  } catch (error) {
    // Driver errors can contain credentials, SQL or personal data. Only expose known codes.
    const known = ['SOURCE_DATABASE_URL_REQUIRED', 'INVALID_STAGING_DATABASE',
      'SOURCE_URL_MUST_HAVE_NO_QUERY', 'SNAPSHOT_MISMATCH'];
    console.error(known.includes(error.message) ? error.message : 'SNAPSHOT_FAILED');
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([source?.end(), target?.end()]);
  }
}
