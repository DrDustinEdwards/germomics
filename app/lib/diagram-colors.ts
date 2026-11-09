// Colors for Prelum's drawn diagrams (render/diagram-draw). A finished SVG cannot read the page's
// variables, so each role is a hex from the germomics palette in app/app.css.

export const DIAGRAM_ASSET_PREFIX = "germomics-";

export const DIAGRAM_COLORS = {
  light: {
    paper: "#fbfafd",
    borderStrong: "#4f2d7f",
    text: "#14101f",
    raised: "#f4f1fa",
    border: "#e2dcec",
    tint: "#f4f1fa",
    heading: "#14101f",
    dangerTint: "#f4f1fa",
    danger: "#402567",
    onAccent: "#ffffff",
  },
  dark: {
    paper: "#120b1f",
    borderStrong: "#c4aef0",
    text: "#edeaf5",
    raised: "#1e1630",
    border: "#2c2440",
    tint: "#1e1630",
    heading: "#edeaf5",
    dangerTint: "#1e1630",
    danger: "#c4aef0",
    onAccent: "#120b1f",
  },
} as const;
