import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "~/lib/sanitize.server";

// THE XSS BOUNDARY ON EVERY POST BODY, pinned for the first time.
//
// sanitizeHtml runs on every save from app/routes/admin.posts.$id.tsx, over both the rich
// editor's output and the raw-HTML toggle. It is the one thing standing between what is typed
// into the admin editor and what BodyRenderer later hands to dangerouslySetInnerHTML, and until
// now nothing tested it: it is built on the Workers `HTMLRewriter` global, so `node --test`
// could not load it.
//
// These tests pin CURRENT behaviour, deliberately. They are the safety net for a dependency
// bump, not a redesign of the policy: if a bump changes what survives sanitization, one of
// these goes red and names which rule moved.

describe("sanitizeHtml", () => {
  it("drops a script element AND its contents, never just unwrapping it", async () => {
    // The distinction is the whole point: removeAndKeepContent on a <script> would leave the
    // payload as text, which a later renderer could reinterpret.
    const out = await sanitizeHtml('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain("<script");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("drops the other dangerous elements with their contents", async () => {
    // Non-void only. A VOID element (embed, input, link, meta) has no contents by definition,
    // so `<embed>payload</embed>` is not a thing a parser can produce: the text is a sibling,
    // not a child, and asserting otherwise tests the fixture rather than the sanitizer.
    for (const tag of ["iframe", "object", "form", "style", "noscript", "textarea"]) {
      const out = await sanitizeHtml(`<p>keep</p><${tag}>payload</${tag}>`);
      expect(out, `${tag} survived`).not.toContain("payload");
      expect(out).toContain("keep");
    }
  });

  it("drops the void dangerous elements too", async () => {
    for (const tag of ["embed", "input", "link", "meta"]) {
      const out = await sanitizeHtml(`<p>keep</p><${tag} src="x">`);
      expect(out, `<${tag}> survived`).not.toContain(`<${tag}`);
      expect(out).toContain("keep");
    }
  });

  it("unwraps a cosmetic span but keeps the text inside it", async () => {
    // The Google-Docs paste case the policy was written for.
    const out = await sanitizeHtml('<p><span style="font-weight:700">words</span></p>');
    expect(out).toContain("words");
    expect(out).not.toContain("<span");
    expect(out).not.toContain("font-weight");
  });

  it("keeps the figure credit span, and strips everything on it but class", async () => {
    const out = await sanitizeHtml('<figcaption><span class="cr" style="color:red" onclick="x()">Credit</span></figcaption>');
    expect(out).toContain('class="cr"');
    expect(out).toContain("Credit");
    expect(out).not.toContain("style=");
    expect(out).not.toContain("onclick");
  });

  it("strips style, id and on* handlers from a tag it keeps", async () => {
    const out = await sanitizeHtml('<p style="color:red" id="x" onmouseover="steal()">text</p>');
    expect(out).toContain("<p>");
    expect(out).toContain("text");
    expect(out).not.toContain("style=");
    expect(out).not.toContain("id=");
    expect(out).not.toContain("onmouseover");
  });

  it("strips a javascript: href but keeps an ordinary one", async () => {
    const bad = await sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(bad).not.toContain("javascript:");
    expect(bad).toContain("click");

    // NOT VACUOUS: a sanitizer that stripped every href would pass the assertion above for the
    // wrong reason.
    const good = await sanitizeHtml('<a href="https://example.com">click</a>');
    expect(good).toContain('href="https://example.com"');
  });

  it("strips data: and vbscript: URLs on both href and src", async () => {
    const a = await sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(a).not.toContain("data:text/html");
    const img = await sanitizeHtml('<img src="vbscript:msgbox(1)" alt="x">');
    expect(img).not.toContain("vbscript:");
    expect(img).toContain('alt="x"');
  });

  it("drops an unsafe srcset candidate and keeps the safe ones", async () => {
    const img = await sanitizeHtml('<img src="/a.jpg" srcset="javascript:alert(1) 1x, /a-2x.jpg 2x" alt="x">');
    expect(img).not.toContain("javascript:");
    expect(img).toContain("/a-2x.jpg 2x");
    const only = await sanitizeHtml('<img src="/a.jpg" srcset="vbscript:x 1x" alt="x">');
    expect(only).not.toContain("srcset");
  });

  it("forces rel=noopener noreferrer on a link that opens in a new tab", async () => {
    const out = await sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("removes comments", async () => {
    const out = await sanitizeHtml("<p>a</p><!-- secret note --><p>b</p>");
    expect(out).not.toContain("secret note");
    expect(out).not.toContain("<!--");
  });

  it("returns an empty string for empty or whitespace input", async () => {
    expect(await sanitizeHtml("")).toBe("");
    expect(await sanitizeHtml("   \n  ")).toBe("");
  });

  it("keeps the semantic tags the policy allows", async () => {
    // The other half of the allowlist: a sanitizer that dropped everything would satisfy every
    // assertion above and destroy every post body.
    const out = await sanitizeHtml(
      "<h2>Heading</h2><p><strong>bold</strong> and <em>italic</em></p><ul><li>one</li></ul><blockquote>quoted</blockquote>",
    );
    for (const fragment of ["<h2>", "<strong>", "<em>", "<ul>", "<li>", "<blockquote>"]) {
      expect(out, `${fragment} was dropped`).toContain(fragment);
    }
  });
});
