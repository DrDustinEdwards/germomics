// Server-side HTML sanitizer for post bodies. Runs on every save (both the rich editor output
// and the raw-HTML toggle) as defense-in-depth + structural cleanup, using the native Workers
// HTMLRewriter — no DOM, no Node deps (CLAUDE.md rule #1).
//
// Policy (single trusted admin, so this is mainly hygiene + the Google-Docs paste cleanup we
// hit in the migration): keep a known set of semantic tags + attributes; unwrap cosmetic
// wrappers (span/font/div); drop dangerous elements entirely; strip every style/on*/class
// (class only survives on aside/code/pre) and any javascript:/vbscript:/data: URL.

const KEEP = new Set([
  "a", "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sup", "sub",
  "ul", "ol", "li", "blockquote", "pre", "code", "hr", "img",
  "figure", "figcaption", "aside",
  "table", "thead", "tbody", "tr", "th", "td",
]);

// Removed with their contents (never just unwrapped).
const DROP = new Set([
  "script", "style", "iframe", "object", "embed", "form", "input", "button",
  "select", "textarea", "link", "meta", "noscript", "svg", "math", "audio", "video",
]);

// Allowed attributes per tag (everything else is stripped — incl. style, id, on*, data-*).
const ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height", "loading"]),
  aside: new Set(["class"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
};

function safeUrl(value: string | null): boolean {
  if (!value) return false;
  return !/^\s*(javascript|vbscript|data):/i.test(value);
}

/** Sanitize a post body's HTML against the allowlist above. Returns cleaned HTML. */
export async function sanitizeHtml(input: string): Promise<string> {
  if (!input || !input.trim()) return "";

  const rewriter = new HTMLRewriter().on("*", {
    element(el) {
      const tag = el.tagName.toLowerCase();

      if (DROP.has(tag)) {
        el.remove(); // element + contents
        return;
      }
      if (!KEEP.has(tag)) {
        el.removeAndKeepContent(); // unwrap span/font/div/etc., keep text
        return;
      }

      const allowed = ATTRS[tag] ?? new Set<string>();
      // el.attributes on the Workers HTMLRewriter Element is an iterator of [name, value];
      // cast past the ambient DOM `Element.attributes` (NamedNodeMap) typing.
      const attrs = el.attributes as unknown as Iterable<[string, string]>;
      for (const [name, value] of attrs) {
        const lname = name.toLowerCase();
        if (!allowed.has(lname)) {
          el.removeAttribute(name);
          continue;
        }
        if ((lname === "href" || lname === "src") && !safeUrl(value)) {
          el.removeAttribute(name);
        }
      }
      // Force safe rel on links that open in a new tab.
      if (tag === "a" && el.getAttribute("target") === "_blank") {
        el.setAttribute("rel", "noopener noreferrer");
      }
    },
    comments(c) {
      c.remove();
    },
  });

  const res = rewriter.transform(new Response(input));
  const out = await res.text();
  // Collapse the runs of whitespace HTMLRewriter can leave after unwrapping.
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
