import { randomBytes } from 'node:crypto';
import { readFileSync, appendFileSync, chmodSync, existsSync } from 'node:fs';

const file = '.env.local';
const content = existsSync(file) ? readFileSync(file, 'utf8') : '';
const has = (key) => new RegExp(`^${key}=`, 'm').test(content);
if (has('AUTH_MIGRATION_DB_PASSWORD') !== has('AUTH_MIGRATION_DATABASE_URL')) {
  throw new Error('Both migration database settings must be present together.');
}
const additions = [];
if (!has('AUTH_MIGRATION_DB_PASSWORD')) {
  const password = randomBytes(32).toString('hex');
  additions.push(`AUTH_MIGRATION_DB_PASSWORD=${password}`,
    `AUTH_MIGRATION_DATABASE_URL=postgresql://auth_migration:${password}@127.0.0.1:55433/auth_migration`);
}
if (!has('SUPABASE_MIGRATION_SOURCE_DATABASE_URL')) additions.push('SUPABASE_MIGRATION_SOURCE_DATABASE_URL=');
if (additions.length) appendFileSync(file, `\n# Supabase authentication migration staging\n${additions.join('\n')}\n`, { mode: 0o600 });
chmodSync(file, 0o600);
console.log('Migration environment prepared. Existing settings preserved; credentials hidden.');
