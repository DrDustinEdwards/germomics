// The site's :::diagram pack. It calls Prelum's diagram model and HTML (render/diagram) and the
// drawings scripts/draw-diagrams.ts committed. It does not use editorialPack, because that pack also
// loads enarratio/plot for :::chart, and this site does not ship Observable Plot.
import { visit } from "unist-util-visit";
import {
  DIAGRAM_THEMES,
  buildDiagramModel,
  diagramAssetPath,
  diagramSize,
  renderDiagramHast,
} from "@drdustinedwards/site-helpers/render/diagram";
import diagramSizes from "../../public/diagrams/sizes.json";
import { DIAGRAM_ASSET_PREFIX } from "~/lib/diagram-colors";

type Model = ReturnType<typeof buildDiagramModel>;
type Warn = (warning: { line: number | null; message: string }) => void;

const sizes = diagramSizes as Record<string, { width: number; height: number }>;

function attributesOf(node: { attributes?: Record<string, string> }): Record<string, string> {
  return node.attributes ?? {};
}

/** remark plugin: (file, sink) => (tree) => void, the shape render()'s packs use. */
function remarkDiagram(file: string, sink: Model[]) {
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
        let model: Model;
        try {
          model = buildDiagramModel(attributesOf(node), fence.value ?? "");
        } catch (error) {
          throw new Error(
            `${error instanceof Error ? error.message : "The diagram could not be read"}${line ? ` (line ${line})` : ""}`,
          );
        }
        const index = sink.push(model) - 1;
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
function rehypeDiagram(models: Model[]) {
  const render = renderDiagramHast(DIAGRAM_ASSET_PREFIX, sizes);
  return (tree: unknown) => {
    visit(
      tree as never,
      "element",
      (node: { properties?: Record<string, unknown>; children?: unknown[] }) => {
        const at = node.properties?.["data-diagram"] ?? node.properties?.dataDiagram;
        if (at === undefined) return;
        const model = models[Number(at)];
        delete node.properties?.["data-diagram"];
        delete node.properties?.dataDiagram;
        node.children = render(model, (node.children ?? []) as never);
      },
    );
  };
}

export function diagramPack() {
  return {
    name: "diagram",
    directives: ["diagram"] as const,
    setup({ file, warn }: { file: string; body: string; warn: Warn }) {
      const diagrams: Model[] = [];
      return {
        remark: [[remarkDiagram, file, diagrams]] as [unknown, ...unknown[]][],
        rehype: [[rehypeDiagram, diagrams]] as [unknown, ...unknown[]][],
        result: () => {
          for (const diagram of diagrams) {
            const drawn = DIAGRAM_THEMES.every((theme) =>
              diagramSize(sizes, diagramAssetPath(diagram.key, theme, DIAGRAM_ASSET_PREFIX)),
            );
            if (drawn) continue;
            warn({
              line: null,
              message: `:::diagram "${diagram.title || diagram.key}" is not drawn yet, so its images are unsized until it is and the body is rendered again`,
            });
          }
          return {
            diagrams: diagrams.map((diagram) => ({ key: diagram.key, source: diagram.source })),
          };
        },
      };
    },
  };
}
