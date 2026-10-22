// app/db/index.server.ts — the only place a Drizzle client is created.
// drizzle(env.DB) over the native D1 binding; never an HTTP client.
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

