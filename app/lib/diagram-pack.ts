// :::diagram stays in the essay. This pack turns the Mermaid fence into the same figure Prelum
// would name (a light image whose address carries the source hash) plus the author's caption.
// render.server.ts then swaps that image for the inline drawing of the same hash.
import { visit } from "unist-util-visit";
import { diagramKey } from "~/lib/blog-diagram.server";

type Diagram = { key: string; alt: string };

function h(tagName: string, properties: Record<string, unknown>, children: unknown[] = []) {
  return { type: "element", tagName, properties, children };
}

function attributesOf(node: { attributes?: Record<string, string> }): Record<string, string> {
  return node.attributes ?? {};
}

/** remark plugin: (sink) => (tree) => void, the shape render()'s packs use. */
function remarkDiagram(sink: Diagram[]) {
  return (tree: unknown) => {
    visit(
      tree as never,
      (node: {
        type?: string;
        name?: string;
        children?: Array<{ type?: string; lang?: string; value?: string }>;
        attributes?: Record<string, string>;
        data?: Record<string, unknown>;
        position?: { start?: { line?: number } };
      }) => {
        if (node.type !== "containerDirective" || node.name !== "diagram") return;
        const children = node.children ?? [];
        const fences = children.filter((child) => child.type === "code");
        const fence = fences[0];
        const line = node.position?.start?.line;
        if (fences.length !== 1 || !fence || fence.lang !== "mermaid") {
          throw new Error(
            `:::diagram${line ? ` on line ${line}` : ""} requires exactly one \`\`\`mermaid fence, found ${fences.length}`,
          );
        }
        const attrs = attributesOf(node);
        const alt = (attrs.alt ?? "").trim();
        if (!alt) {
          throw new Error(
            `:::diagram "${attrs.title ?? "untitled"}" requires an alt attribute${line ? ` (line ${line})` : ""}`,
          );
        }
        const key = diagramKey(fence.value ?? "");
        const index = sink.push({ key, alt }) - 1;
        node.data = {
          ...node.data,
          hName: "figure",
          hProperties: { className: ["diagram-figure"], "data-diagram": String(index) },
        };
        node.children = children.filter((child) => child.type !== "code");
      },
    );
  };
}

/** rehype plugin: (models) => (tree) => void. */
function rehypeDiagram(models: Diagram[]) {
  return (tree: unknown) => {
    visit(
      tree as never,
      "element",
      (node: { properties?: Record<string, unknown>; children?: unknown[] }) => {
        const at = node.properties?.["data-diagram"] ?? node.properties?.dataDiagram;
        if (at === undefined) return;
        const model = models[Number(at)];
        if (!model) return;
        delete node.properties?.["data-diagram"];
        delete node.properties?.dataDiagram;
        const caption = node.children ?? [];
        node.children = [
          h(
            "img",
            {
              className: ["diagram-image", "diagram-light"],
              src: `/diagrams/germomics-${model.key}-light.svg`,
              alt: model.alt,
              width: 680,
              height: 188,
            },
            [],
          ),
          ...(caption.length > 0 ? [h("figcaption", {}, caption)] : []),
        ];
      },
    );
  };
}

export function diagramPack() {
  return {
    name: "diagram",
    directives: ["diagram"] as const,
    setup() {
      const diagrams: Diagram[] = [];
      return {
        remark: [[remarkDiagram, diagrams]] as [unknown, ...unknown[]][],
        rehype: [[rehypeDiagram, diagrams]] as [unknown, ...unknown[]][],
        result: () => ({ diagrams: diagrams.map((diagram) => ({ key: diagram.key })) }),
      };
    },
  };
}
