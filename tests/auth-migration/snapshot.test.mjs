import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { snapshot, stagingConfig } from '../../scripts/auth-migration/snapshot.mjs';

test('staging destination must be the dedicated local database', () => {
  for (const value of ['postgresql://x@example.com:55433/auth_migration',
    'postgresql://x@localhost:55432/kakao_test',
    'postgresql://x@localhost:55433/auth_migration?host=example.com']) {
    assert.throws(() => stagingConfig(value));
  }
});

test('snapshot preserves every source field and rolls back incomplete copies', async () => {
  const config = stagingConfig(process.env.AUTH_MIGRATION_DATABASE_URL);
  const admin = new pg.Client(config);
  await admin.connect();
  const database = `migration_fixture_${randomBytes(8).toString('hex')}`;
  let source;
  let target;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    const url = new URL(config.connectionString);
    url.pathname = `/${database}`;
    source = new pg.Client({ connectionString: url.href });
    target = new pg.Client({ connectionString: url.href });
    await source.connect();
    await target.connect();
    await source.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb, created_at timestamptz, extra bigint);
      CREATE TABLE auth.identities (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id), provider text);
      CREATE TABLE public.tickets (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id));
      INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001', '{"phone":null,"nested":{"n":9007199254740993}}', '2026-01-01T00:00:00.123456Z', 9007199254740993);
      INSERT INTO auth.identities VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','google');
      INSERT INTO public.tickets VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001');`);
    const first = await snapshot(source, target);
    assert.deepEqual(first.counts, { 'auth.users': 1, 'auth.identities': 1, 'public.tickets': 1 });
    const stored = await target.query("SELECT payload FROM auth_source.rows WHERE source_table='auth.users'");
    const original = await source.query('SELECT row_to_json(t)::text AS payload FROM auth.users t');
    assert.equal(stored.rows[0].payload, original.rows[0].payload);
    assert.match(stored.rows[0].payload, /9007199254740993/);
    assert.match(stored.rows[0].payload, /123456/);
    // New runs retain prior snapshots, including empty tables after a source deletion.
    await source.query('DELETE FROM public.tickets');
    const second = await snapshot(source, target);
    assert.equal(second.counts['public.tickets'], 0);
    assert.notEqual(first.snapshotId, second.snapshotId);
    await source.query('DROP TABLE public.tickets');
    await assert.rejects(snapshot(source, target));
    const runs = await target.query('SELECT count(*)::int AS count FROM auth_source.snapshots');
    assert.equal(runs.rows[0].count, 2);
  } finally {
    await Promise.allSettled([source?.end(), target?.end()]);
    await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
    await admin.end();
  }
});
