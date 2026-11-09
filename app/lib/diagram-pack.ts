// :::diagram stays a known directive so an essay that still has one renders. The drawing
// itself is the inline figure on the episode page (public/blog-diagrams), not a Mermaid image.
import { visit } from "unist-util-visit";

type Parent = { children?: unknown[] };

/** remark plugin. Drops the directive, fence and caption. The page supplies the figure. */
function remarkDiagram() {
  return (tree: unknown) => {
    visit(
      tree as never,
      (node: { type?: string; name?: string }, index: number | null, parent: Parent | null) => {
        if (node.type !== "containerDirective" || node.name !== "diagram") return;
        if (!parent || index === null || !parent.children) return;
        parent.children.splice(index, 1);
        return index;
      },
    );
  };
}

export function diagramPack() {
  return {
    name: "diagram",
    directives: ["diagram"] as const,
    setup() {
      return {
        remark: [[remarkDiagram]] as [unknown, ...unknown[]][],
        rehype: [] as [unknown, ...unknown[]][],
        result: () => ({ diagrams: [] as const }),
      };
    },
  };
}
