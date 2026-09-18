// Heavy + window-only: imported ONLY via lazy() from data.$slug, so the Maps JS API is
// code-split to its own chunk and never touches the server or content bundles (CLAUDE.md
// rule #7). The map is decorative (aria-hidden), and the page's data table is the accessible
// equivalent.
//
// GOOGLE MAPS, NOT MAPLIBRE (2026-09-08). maplibre-gl was removed rather than upgraded:
// GHSA-jrc7-96c5-q579 (CRITICAL) is a bypass of its DOM.sanitize(), it affects every version
// through 6.4.0, and the fix is a major bump this repo has no suite to land against. Removing
// the dependency closes the advisory outright.
//
// WHAT THAT TRADED, recorded rather than glossed, because it is not a pure win. The MapLibre
// style host could supply DATA (an attribution string, tile URLs). maps.googleapis.com supplies
// EXECUTABLE JAVASCRIPT into this origin by design, which is a larger trust surface, not a
// smaller one. What makes it acceptable is that it is a first-party Google origin under an
// API key we control rather than a public demo host, and that the CSP now names it explicitly.
//
// NO HTML REACHES THE MAP. Info windows are built from a text node, never from an HTML string:
// InfoWindow.setContent() parses a string as markup, and `p.label` / `p.value` are dataset
// fields. A text node cannot become markup, which is the same property Popup.setText() gave us
// before and the reason the old code used it.
import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { DataPoint } from "~/lib/datasets.server";

// BUILD-TIME, NOT RUNTIME. Vite inlines import.meta.env.VITE_* into the CLIENT bundle at build
// time, so the value has to be present when `react-router build` runs (a Workers Builds
// environment variable, or .env locally). The matching entry in wrangler.jsonc `vars` documents
// the same value for the deploy and is deliberately NOT what this reads: a Worker var is not
// visible to a browser bundle. A Maps browser key is public by construction, which is why it
// must be HTTP-referrer restricted in the Google Cloud console rather than kept secret.
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
// Advanced Markers RENDER ONLY ON A MAP WITH A MAP ID. This is not optional styling: without a
// mapId the marker library loads and nothing appears. DEMO_MAP_ID is Google's own development
// id and is the documented fallback; a real id belongs in the environment before launch.
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || "DEMO_MAP_ID";

// THE PIN IS THE BRAND VIOLET, and it is set here because nowhere else can set it. The base map
// is styled in the Google Cloud console against the map ID (a `styles` option is refused when a
// mapId is present), but that styling reaches Google's own place pins only. These markers are
// ours, drawn by this component. The values are app.css's light-theme --brand and
// --brand-strong; they are literals rather than var() because PinElement paints into its own
// SVG and does not resolve CSS custom properties from the page.
const PIN = { background: "#4f2d7f", borderColor: "#402567", glyphColor: "#ffffff" } as const;

export default function DataMap({
  center,
  zoom,
  points,
}: {
  center: [number, number];
  zoom: number;
  points: DataPoint[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(!API_KEY);

  useEffect(() => {
    if (!ref.current || !API_KEY) return;
    const container = ref.current;
    // Cancelled on unmount: the API loads asynchronously and React 18 mounts effects twice in
    // development, so a late resolve must not build a second map into a detached node.
    let cancelled = false;
    let markers: google.maps.marker.AdvancedMarkerElement[] = [];

    (async () => {
      try {
        setOptions({ key: API_KEY, v: "weekly", mapIds: [MAP_ID] });
        const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
        ]);
        if (cancelled) return;

        const map = new Map(container, {
          // `center` IS [lng, lat], the order maplibre-gl took and the order every dataset in
          // datasets.server.ts is written in (Broad Street is [-0.1367, 51.5132]). Google wants
          // { lat, lng }. The rewrite read them the other way round, so the first live render
          // opened in the Indian Ocean while the markers, which use named fields, sat in London.
          center: { lat: center[1], lng: center[0] },
          zoom,
          mapId: MAP_ID,
          // The old map carried a navigation control and nothing else. Keep the surface that
          // small: no street view, no map-type switcher, no fullscreen.
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const info = new InfoWindow();
        for (const p of points) {
          const pin = new PinElement(PIN);
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: `${p.label}: ${p.value}`,
            content: pin.element,
          });
          marker.addListener("click", () => {
            // TEXT NODE, NOT A STRING. setContent(string) parses markup; setContent(Node) does
            // not. This is the one line that keeps dataset text out of the DOM as HTML.
            info.setContent(document.createTextNode(`${p.label}: ${p.value}`));
            info.open({ map, anchor: marker });
          });
          markers.push(marker);
        }
      } catch {
        // A blocked script, a bad key, or an offline browser. The data table below is the real
        // content, so this degrades to no map rather than to a broken page.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      for (const marker of markers) marker.map = null;
      markers = [];
    };
  }, [center, zoom, points]);

  return (
    <>
      {!failed && (
        <div ref={ref} aria-hidden className="h-80 w-full overflow-hidden rounded-xl border border-border" />
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {failed ? "Map unavailable. The table below carries the same data." : "Map data © Google."}
      </p>
    </>
  );
}
