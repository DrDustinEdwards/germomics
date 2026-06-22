// Back-compat shim — the canonical renderer is BodyRenderer (built once, reused by articles and
// episodes). Existing `<Prose html={...} />` callers keep working.
export { BodyRenderer as Prose } from "./BodyRenderer";
