// The test Worker's main module: only the Durable Object class the RATE_LIMITER binding needs, so
// tests do not load the real entry (and its server build).
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";
export default { fetch: () => new Response(null, { status: 404 }) } satisfies ExportedHandler;
