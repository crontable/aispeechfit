import type { Pool, PoolClient } from 'pg';

// Register before the first connection, including clients later evicted by query errors.
export function trackPoolShutdown(pool: Pool): () => Promise<void> {
  const pending = new Set<Promise<void>>();
  const connected = (client: PoolClient) => {
    const closed = new Promise<void>((resolve) => {
      client.once('end', () => {
        pending.delete(closed);
        resolve();
      });
    });
    pending.add(closed);
  };
  pool.on('connect', connected);
  return async () => {
    // pg-pool removes clients from its count before their sockets emit 'end'.
    await pool.end();
    await Promise.all(pending);
    pool.off('connect', connected);
  };
}
