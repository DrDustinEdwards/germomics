// TipTap/ProseMirror editor implementation. Dynamically imported by RichTextEditor (never in the
// SSR or shared client bundle — CLAUDE.md rule #7). Outputs sanitized-ish HTML compatible with
// the existing bodies (the server re-sanitizes on save). Paste cleanup strips Google-Docs
// style/span noise; a custom Callout node round-trips <aside class="callout">.
import { useEffect, useRef } from "react";
import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Code2, Minus, Link2, ImagePlus, Images, Undo2, Redo2, Info,
} from "lucide-react";

// Minimal callout node → <aside class="callout"> … </aside> (block, holds paragraphs).
const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML: () => [{ tag: "aside.callout" }],
  renderHTML: ({ HTMLAttributes }) => [
    "aside",
    mergeAttributes(HTMLAttributes, { class: "callout" }),
    0,
  ],
});

// Figure node → <figure><img loading=lazy decoding=async><figcaption>CAPTION <span class="cr">CREDIT</span></figcaption></figure>.
// An atom block so caption/credit ride on attributes and the whole unit survives a save round-trip.
// Reads src/srcset/sizes off the <img>, so a server-inserted responsive <picture> figure collapses to
// a still-responsive <img> rather than being dropped when loaded into the rich editor.
const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: "" },
      srcset: { default: "" },
      sizes: { default: "" },
      alt: { default: "" },
      // width/height ride along for CLS and to encode the inline display size (the prose CSS caps
      // the rendered width to these). loading lets the lead figure stay eager across a save.
      width: { default: "" },
      height: { default: "" },
      loading: { default: "" },
      caption: { default: "" },
      credit: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const img = el.querySelector("img");
          const cap = el.querySelector("figcaption");
          let caption = "";
          let credit = "";
          if (cap) {
            const cr = cap.querySelector(".cr");
            credit = cr?.textContent?.trim() ?? "";
            const clone = cap.cloneNode(true) as HTMLElement;
            clone.querySelector(".cr")?.remove();
            caption = clone.textContent?.trim() ?? "";
          }
          return {
            src: img?.getAttribute("src") ?? "",
            srcset: img?.getAttribute("srcset") ?? "",
            sizes: img?.getAttribute("sizes") ?? "",
            alt: img?.getAttribute("alt") ?? "",
            width: img?.getAttribute("width") ?? "",
            height: img?.getAttribute("height") ?? "",
            loading: img?.getAttribute("loading") ?? "",
            caption,
            credit,
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const { src, srcset, sizes, alt, width, height, loading, caption, credit } =
      node.attrs as Record<string, string>;
    const imgAttrs: Record<string, string> = {
      src,
      alt,
      loading: loading || "lazy",
      decoding: "async",
    };
    if (srcset) imgAttrs.srcset = srcset;
    if (sizes) imgAttrs.sizes = sizes;
    if (width) imgAttrs.width = width;
    if (height) imgAttrs.height = height;
    const img: (string | Record<string, string>)[] = ["img", imgAttrs];

    if (!caption && !credit) return ["figure", {}, img];

    const capChildren: unknown[] = [];
    if (caption) capChildren.push(caption);
    if (credit) {
      if (caption) capChildren.push(" ");
      capChildren.push(["span", { class: "cr" }, credit]);
    }
    return ["figure", {}, img, ["figcaption", {}, ...capChildren]] as never;
  },
});

// Strip Google-Docs paste noise before ProseMirror parses it.
function cleanPaste(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s(style|class|lang|dir)="[^"]*"/gi, "")
    .replace(/<\/?(span|font|o:p)[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "");
}

function Btn({
  on,
  active,
  label,
  children,
}: {
  on: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-md transition ${
        active ? "bg-brand text-white" : "text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function TipTapBody({
  value,
  onChange,
  postId,
}: {
  value: string;
  onChange: (html: string) => void;
  postId: number | string;
}) {
  const lastEmitted = useRef(value);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const figureRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    // Tiptap 3 stopped re-rendering on every transaction; the toolbar's active states need it.
    shouldRerenderOnTransaction: true,
    extensions: [
      // Tiptap 3's StarterKit carries Link, Underline and a trailing paragraph. Link is configured
      // here; the other two stay off so the editor writes the same HTML it did on 2.x.
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } },
        underline: false,
        trailingNode: false,
      }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Write the post…  (paste from Docs is cleaned automatically)" }),
      Callout,
      Figure,
    ],
    content: value || "",
    editorProps: {
      transformPastedHTML: cleanPaste,
      attributes: {
        class:
          "min-h-[24rem] max-w-none rounded-b-xl bg-card px-4 py-3 text-[1.02rem] leading-relaxed outline-none " +
          "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-6 " +
          "[&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 " +
          "[&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 " +
          "[&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:italic " +
          "[&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm " +
          "[&_a]:text-accent [&_a]:underline [&_img]:rounded-lg [&_img]:border [&_img]:border-border " +
          "[&_figure]:my-4 [&_figcaption]:mt-1.5 [&_figcaption]:text-sm [&_figcaption]:text-muted [&_figcaption_.cr]:text-xs [&_figcaption_.cr]:text-muted " +
          "[&_aside.callout]:rounded-xl [&_aside.callout]:border [&_aside.callout]:border-border [&_aside.callout]:bg-surface [&_aside.callout]:p-3",
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // Sync external value changes (e.g. toggling back from raw HTML) without clobbering the cursor.
  useEffect(() => {
    if (editor && value !== lastEmitted.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      lastEmitted.current = value;
    }
  }, [value, editor]);

  if (!editor) return <div className="min-h-[24rem] rounded-b-xl bg-card" aria-hidden />;

  async function uploadInlineImage(file: File) {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", "image");
    body.set("postId", String(postId));
    const res = await fetch("/admin/upload", { method: "POST", body });
    const data = (await res.json()) as { ok: boolean; url?: string };
    if (!data.ok || !data.url) {
      alert("Image upload failed.");
      return;
    }
    let alt = window.prompt("Alt text for this image (required for accessibility):", file.name) || "";
    alt = alt.trim();
    editor!.chain().focus().setImage({ src: data.url, alt }).run();
  }

  // Upload, then collect alt/caption/credit and insert a <figure> block at the cursor.
  async function uploadFigure(file: File) {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", "image");
    body.set("postId", String(postId));
    const res = await fetch("/admin/upload", { method: "POST", body });
    const data = (await res.json()) as { ok: boolean; url?: string };
    if (!data.ok || !data.url) {
      alert("Image upload failed.");
      return;
    }
    const alt = (window.prompt("Alt text (required for accessibility):", file.name) || "").trim();
    const caption = (window.prompt("Caption (optional):", "") || "").trim();
    const credit = (window.prompt("Credit (optional, e.g. photographer or source):", "") || "").trim();
    editor!.chain().focus().insertContent({
      type: "figure",
      attrs: { src: data.url, alt, caption, credit },
    }).run();
  }

  function toggleLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave blank to remove):", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function toggleCallout() {
    if (editor!.isActive("callout")) editor!.chain().focus().lift("callout").run();
    else editor!.chain().focus().wrapIn("callout").run();
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-border bg-surface px-1.5 py-1">
        <Btn label="Bold" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></Btn>
        <Btn label="Italic" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></Btn>
        <Btn label="Strikethrough" active={editor.isActive("strike")} on={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn label="Heading 2" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></Btn>
        <Btn label="Heading 3" active={editor.isActive("heading", { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn label="Bullet list" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></Btn>
        <Btn label="Numbered list" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></Btn>
        <Btn label="Quote" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></Btn>
        <Btn label="Code block" active={editor.isActive("codeBlock")} on={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 size={15} /></Btn>
        <Btn label="Callout" active={editor.isActive("callout")} on={toggleCallout}><Info size={15} /></Btn>
        <Btn label="Divider" on={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn label="Link" active={editor.isActive("link")} on={toggleLink}><Link2 size={15} /></Btn>
        <Btn label="Insert image" on={() => fileRef.current?.click()}><ImagePlus size={15} /></Btn>
        <Btn label="Insert figure (image with caption and credit)" on={() => figureRef.current?.click()}><Images size={15} /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn label="Undo" on={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Btn>
        <Btn label="Redo" on={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Btn>
      </div>
      <EditorContent editor={editor} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadInlineImage(f);
          e.target.value = "";
        }}
      />
      <input
        ref={figureRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadFigure(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
