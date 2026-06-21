// lib/db.ts drizzle over the native D1 binding (getCloudflareContext().env.DB).
// Exposed as a lazy `db` proxy so callers can `import { db }` and use it like a normal
// Drizzle client; the binding is resolved per access, inside the request context, because
// getCloudflareContext() is not available at module-eval time.

import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from '@/db/schema';

export type DB = DrizzleD1Database<typeof schema>;

function client(): DB {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const c = client();
    const value = Reflect.get(c as object, prop, receiver);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});
