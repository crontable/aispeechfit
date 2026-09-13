import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stagingConfig } from './snapshot.mjs';

// A local, reviewable candidate only. Never updates source tickets or auth users.
let source, target;
try {
  const email = process.env.AUTH_TICKET_SOURCE_EMAIL;
  if (!email) throw new Error('SOURCE_EMAIL_REQUIRED');
  const sourceUrl = new URL(process.env.SUPABASE_MIGRATION_SOURCE_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(sourceUrl.protocol) || sourceUrl.search || sourceUrl.hash) {
    throw new Error('INVALID_SOURCE_URL');
  }
  target = new pg.Client(stagingConfig(process.env.AUTH_MIGRATION_DATABASE_URL));
  source = new pg.Client({ connectionString: sourceUrl.href,
    ssl: { rejectUnauthorized: true,
      ca: readFileSync(new URL('./certs/prod-ca-2021.crt', import.meta.url), 'utf8') },
    connectionTimeoutMillis: 10000 });
  await source.connect();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await source.query("SET LOCAL statement_timeout = '15s'");
  await source.query('SET LOCAL row_security = off');
  const users = await source.query('SELECT id FROM auth.users WHERE lower(email) = lower($1)', [email]);
  if (users.rowCount !== 1) throw new Error('SOURCE_USER_NOT_UNIQUE');
  const tickets = await source.query(`SELECT id::text, row_to_json(t)::text AS payload,
    (is_active AND started_at <= now() AND expires_at >= now()) AS active
    FROM public.tickets t WHERE user_id = $1
      AND is_active AND started_at <= now() AND expires_at >= now()
    ORDER BY id`, [users.rows[0].id]);
  if (tickets.rowCount !== 1) throw new Error('SOURCE_TICKET_NOT_UNIQUE');
  if (!tickets.rows[0].active) throw new Error('SOURCE_TICKET_NOT_ACTIVE');
  const ticket = tickets.rows[0];
  const hash = createHash('sha256').update(ticket.payload).digest('hex');
  await target.connect();
  await target.query('BEGIN');
  await target.query("SET LOCAL statement_timeout = '15s'");
  const identity = await target.query(`SELECT i.user_id FROM better_auth.kakao_identities i
    JOIN better_auth.users u ON u.id = i.user_id
    WHERE i.app_id = $1 AND i.status = 'confirmed' FOR SHARE OF i, u`, [process.env.KAKAO_APP_ID]);
  if (identity.rowCount !== 1) throw new Error('LOCAL_CONFIRMED_USER_NOT_UNIQUE');
  await target.query('CREATE SCHEMA IF NOT EXISTS auth_source');
  await target.query('REVOKE ALL ON SCHEMA auth_source FROM PUBLIC');
  await target.query(`CREATE TABLE IF NOT EXISTS auth_source.ticket_transfer_candidates (
    source_ticket_id bigint PRIMARY KEY, source_payload text NOT NULL,
    source_sha256 text NOT NULL, target_user_id uuid NOT NULL REFERENCES better_auth.users(id) ON DELETE RESTRICT,
    captured_at timestamptz NOT NULL DEFAULT now())`);
  await target.query('REVOKE ALL ON auth_source.ticket_transfer_candidates FROM PUBLIC');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    if ((await target.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount) {
      await target.query(`REVOKE ALL ON SCHEMA auth_source FROM ${role}`);
      await target.query(`REVOKE ALL ON auth_source.ticket_transfer_candidates FROM ${role}`);
    }
  }
  await target.query(`INSERT INTO auth_source.ticket_transfer_candidates
    (source_ticket_id, source_payload, source_sha256, target_user_id) VALUES ($1,$2,$3,$4)
    ON CONFLICT (source_ticket_id) DO NOTHING`, [ticket.id, ticket.payload, hash, identity.rows[0].user_id]);
  const stored = (await target.query(`SELECT source_payload, source_sha256, target_user_id
    FROM auth_source.ticket_transfer_candidates WHERE source_ticket_id = $1 FOR UPDATE`, [ticket.id])).rows[0];
  if (stored.source_payload !== ticket.payload || stored.source_sha256 !== hash
      || stored.target_user_id !== identity.rows[0].user_id) throw new Error('CANDIDATE_CHANGED_REVIEW_REQUIRED');
  await source.query('COMMIT');
  await target.query('COMMIT');
  console.log(JSON.stringify({ prepared: 1, sourceReadOnly: true, payloadVerified: true,
    targetPhoneConfirmed: true, remoteTicketChanged: false }));
} catch (error) {
  await Promise.allSettled([source?.query('ROLLBACK'), target?.query('ROLLBACK')]);
  const known = ['SOURCE_EMAIL_REQUIRED', 'INVALID_SOURCE_URL', 'INVALID_STAGING_DATABASE',
    'SOURCE_USER_NOT_UNIQUE', 'SOURCE_TICKET_NOT_UNIQUE', 'SOURCE_TICKET_NOT_ACTIVE',
    'LOCAL_CONFIRMED_USER_NOT_UNIQUE', 'CANDIDATE_CHANGED_REVIEW_REQUIRED'];
  console.error(JSON.stringify({ error: known.includes(error.message) ? error.message : 'TICKET_PREPARATION_FAILED',
    code: /^[A-Z0-9_]{3,50}$/.test(error.code ?? '') ? error.code : undefined }));
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source?.end(), target?.end()]);
}
