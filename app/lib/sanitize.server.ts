// Server-side HTML sanitizer for post bodies. Runs on every save (both the rich editor output
// and the raw-HTML toggle) as defense-in-depth + structural cleanup, using the native Workers
// HTMLRewriter — no DOM, no Node deps.
//
// Policy (single trusted admin, so this is mainly hygiene + the Google-Docs paste cleanup we
// hit in the migration): keep a known set of semantic tags + attributes; unwrap cosmetic
// wrappers (span/font/div); drop dangerous elements entirely; strip every style/on*/class
// (class only survives on aside/code/pre) and any javascript:/vbscript:/data: URL.

const KEEP = new Set([
  "a", "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sup", "sub",
  "ul", "ol", "li", "blockquote", "pre", "code", "hr", "img",
  "figure", "figcaption", "picture", "source", "aside",
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
  img: new Set(["src", "alt", "title", "width", "height", "loading", "decoding", "srcset", "sizes"]),
  source: new Set(["src", "srcset", "sizes", "type", "media"]),
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
      // Keep the figure credit span (<span class="cr">…</span>); unwrap every other
      // cosmetic span/font/div so Google-Docs paste noise still collapses to text.
      if (tag === "span" && el.getAttribute("class") === "cr") {
        // SNAPSHOT BEFORE MUTATING. See the note on the attribute loop below.
        const attrs = [...(el.attributes as unknown as Iterable<[string, string]>)];
        for (const [name] of attrs) {
          if (name.toLowerCase() !== "class") el.removeAttribute(name);
        }
        return;
      }
      if (!KEEP.has(tag)) {
        el.removeAndKeepContent(); // unwrap span/font/div/etc., keep text
        return;
      }

      const allowed = ATTRS[tag] ?? new Set<string>();
      // el.attributes on the Workers HTMLRewriter Element is an iterator of [name, value];
      // cast past the ambient DOM `Element.attributes` (NamedNodeMap) typing.
      //
      // SPREAD INTO AN ARRAY FIRST, and this is a fix rather than a style choice. The Workers
      // HTMLRewriter REFUSES to continue an attribute iterator after removeAttribute has run:
      // "The attributes of this element have been modified during iteration. You must create a
      // new iterator after modifying attributes." So the loop below threw on the FIRST
      // disallowed attribute it met, which meant style, id and every on* handler survived on
      // any element that carried one. Found 2026-09-08 by the first test ever written against
      // this file (test/sanitize.test.ts); it had been live since the sanitizer was written.
      const attrs = [...(el.attributes as unknown as Iterable<[string, string]>)];
      for (const [name, value] of attrs) {
        const lname = name.toLowerCase();
        if (!allowed.has(lname)) {
          el.removeAttribute(name);
          continue;
        }
        if ((lname === "href" || lname === "src") && !safeUrl(value)) {
          el.removeAttribute(name);
        } else if (lname === "srcset") {
          // Each candidate is "url [descriptor]"; one with an unsafe URL is dropped, and an
          // attribute left with none is removed (Grok audit 2026-10-21, GE-5).
          const kept = value
            .split(",")
            .map((c) => c.trim())
            .filter((c) => c && safeUrl(c.split(/\s+/)[0] ?? ""));
          if (kept.length === 0) el.removeAttribute(name);
          else el.setAttribute(name, kept.join(", "));
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
  })
    // TOP-LEVEL COMMENTS TOO. An element selector's `comments` handler only sees comments INSIDE
    // a matching element, so a comment between two block elements (exactly what a Google-Docs or
    // Word paste leaves behind) survived the "*" handler above. Found by the same first test.
    .onDocument({
      comments(c) {
        c.remove();
      },
    });

  const res = rewriter.transform(new Response(input));
  const out = await res.text();
  // Collapse the runs of whitespace HTMLRewriter can leave after unwrapping.
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
