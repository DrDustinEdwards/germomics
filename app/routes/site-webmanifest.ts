import { webManifest } from "@drdustinedwards/site-helpers/icons";

export function loader() {
  const manifest = webManifest({
    name: "Germomics",
    description: "A podcast and writing project about microbiology and history.",
    themeColor: "#4F2D7F",
    backgroundColor: "#FBFAFD",
  });
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
  });
}
