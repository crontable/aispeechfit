import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { Pool } from 'pg';
import { trackPoolShutdown } from './pool-cleanup.ts';

test('test pool shutdown waits for client end even when the pool no longer counts the connection', async (t) => {
  const url = new URL(process.env.AUTH_MIGRATION_DATABASE_URL!);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.port, '55433');
  assert.equal(url.pathname, '/auth_migration');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');

  for (const eviction of ['idle shutdown', 'query error'] as const) {
    await t.test(eviction, async () => {
      const pool = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 5000 });
      const shutdown = trackPoolShutdown(pool);
      const endRequested = Promise.withResolvers<void>();
      const allowEnd = Promise.withResolvers<void>();
      let closing: Promise<void> | undefined;
      try {
        const client = await pool.connect();
        await client.query('select 1');
        const originalEnd = client.end.bind(client);
        // Hold the real socket open at the gap between pool eviction and Client.end.
        client.end = ((callback?: (error?: Error) => void) => {
          endRequested.resolve();
          const ended = allowEnd.promise.then(() => originalEnd());
          if (callback) {
            void ended.then(() => callback(), callback);
            return;
          }
          return ended;
        }) as typeof client.end;
        let clientEnded = false;
        client.once('end', () => { clientEnded = true; });
        client.release(eviction === 'query error' ? new Error('synthetic query failure') : undefined);
        let shutdownFinished = false;
        closing = shutdown().then(() => { shutdownFinished = true; });
        await endRequested.promise;
        // Flush promise continuations without relying on an arbitrary sleep duration.
        await setImmediate();
        assert.equal(pool.totalCount, 0);
        assert.equal(clientEnded, false);
        assert.equal(shutdownFinished, false, 'cleanup completed while a PostgreSQL client was still open');
        allowEnd.resolve();
        await closing;
        assert.equal(clientEnded, true);
      } finally {
        allowEnd.resolve();
        await (closing ?? shutdown());
      }
    });
  }
});
