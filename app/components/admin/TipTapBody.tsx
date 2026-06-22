// TipTap/ProseMirror editor implementation. Dynamically imported by RichTextEditor (never in the
// SSR or shared client bundle — CLAUDE.md rule #7). Outputs sanitized-ish HTML compatible with
// the existing bodies (the server re-sanitizes on save). Paste cleanup strips Google-Docs
// style/span noise; a custom Callout node round-trips <aside class="callout">.
import { useEffect, useRef } from "react";
import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Code2, Minus, Link2, ImagePlus, Undo2, Redo2, Info,
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Write the post…  (paste from Docs is cleaned automatically)" }),
      Callout,
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
      editor.commands.setContent(value || "", false);
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
    </div>
  );
}
