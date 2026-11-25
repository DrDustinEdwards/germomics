import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "@dustinedwards/site-runtime/context";

/** The router context a loader or action reads its bindings from. */
export function routeContext(env: Env, ctx: ExecutionContext = {} as ExecutionContext) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  return context;
}

/** Every key out of the KV namespace, so a case starts with no rate-limit or cache state. */
export async function clearKv(kv: KVNamespace) {
  const { keys } = await kv.list();
  await Promise.all(keys.map((k) => kv.delete(k.name)));
}
