import { readFileSync } from "node:fs";
import pg from "pg";
import { getLocalAuthConfig } from "../../lib/auth/local-config.ts";

const config = getLocalAuthConfig();
const client = new pg.Client({ connectionString: config.databaseUrl });
try {
  await client.connect();
  await client.query(
    readFileSync(
      "supabase/migrations/20260913000000_create_better_auth.sql",
      "utf8",
    ),
  );
  console.log("Local better_auth schema ready.");
} catch {
  console.error("Local auth schema setup failed.");
  process.exitCode = 1;
} finally {
  await client.end();
}
