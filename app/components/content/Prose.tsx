// Renders single-admin-authored HTML body. The author is the only writer (trusted), so the
// stored HTML is rendered directly. Base element styles (headings/links) come from app.css;
// these arbitrary variants handle flow content spacing.
export function Prose({ html }: { html: string }) {
  return (
    <div
      className="max-w-none text-[1.05rem] leading-relaxed [&_a]:text-accent [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-xl [&_img]:rounded-lg [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
