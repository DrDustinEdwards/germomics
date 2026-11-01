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
import { siteIsDark, toLatLng } from "~/lib/map";

// BUILD-TIME, NOT RUNTIME. Vite inlines import.meta.env.VITE_* into the CLIENT bundle at build
// time, so the value has to be present when `react-router build` runs (a GitHub repo
// variable read by CI's deploy, or .env locally). The matching entry in wrangler.jsonc `vars` documents
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
// ours, drawn by this component. The values are app.css's --brand and --brand-strong for each
// theme; they are literals rather than var() because PinElement paints into its own SVG and
// does not resolve CSS custom properties from the page.
const PIN_LIGHT = { background: "#4f2d7f", borderColor: "#402567", glyphColor: "#ffffff" } as const;
const PIN_DARK = { background: "#c4aef0", borderColor: "#b29ad9", glyphColor: "#120b1f" } as const;

// A COUNT IS A DOT, A LANDMARK IS A PIN. A map of a few hundred counts (Snow's 321 addresses) draws each as a small
// violet dot whose area grows with its count, so the cluster reads as Snow's bars did; a pin each would bury the
// streets. Landmarks (the pumps) keep pins, in the ink colors (app.css --ink, --bg), since the violet is the counts'
// and the cyan is reserved for interactive states. The marked landmark (Broad Street) is drawn larger.
const DOT_LIGHT = { fill: "#4f2d7f", edge: "#ffffff" } as const;
const DOT_DARK = { fill: "#c4aef0", edge: "#120b1f" } as const;
const LANDMARK_LIGHT = { background: "#14101f", borderColor: "#14101f", glyphColor: "#fbfafd" } as const;
const LANDMARK_DARK = { background: "#edeaf5", borderColor: "#edeaf5", glyphColor: "#120b1f" } as const;

/** One array for every map without landmarks, so the map effect's dependency stays the same between renders. */
const NO_LANDMARKS: DataPoint[] = [];

/** A dot whose area follows the count: 1 is 8 px across, 18 (the most at one address) about 21. */
function dot(value: number, dark: boolean): HTMLElement {
  const { fill, edge } = dark ? DOT_DARK : DOT_LIGHT;
  const size = Math.round(5 + 3 * Math.sqrt(Math.max(value, 1)));
  const el = document.createElement("span");
  el.style.cssText = `display:block;width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:1px solid ${edge};opacity:0.8;transform:translateY(50%)`;
  return el;
}

// THE SITE'S THEME, READ THE WAY app.css DECIDES IT. This is only the pair of DOM reads; the
// rule that resolves them lives in ~/lib/map as siteIsDark(), where a test can reach it without
// a browser. Splitting it that way is the whole point: the reads need a document, the rule does
// not, and it was the rule that nothing covered.
function readSiteIsDark(): boolean {
  return siteIsDark(
    document.documentElement.getAttribute("data-theme"),
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

export default function DataMap({
  center,
  zoom,
  points,
  landmarks = NO_LANDMARKS,
  marked = null,
}: {
  center: [number, number];
  zoom: number;
  /** Valued points: pins when there are a few, dots sized by value when there are many. */
  points: DataPoint[];
  /** Places drawn as pins over the points, labeled only by name. */
  landmarks?: DataPoint[];
  /** The landmark label to draw larger. */
  marked?: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(!API_KEY);
  const [dark, setDark] = useState(readSiteIsDark);

  // Follow the theme switch and the system preference while the page is open.
  useEffect(() => {
    const update = () => setDark(readSiteIsDark());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!ref.current || !API_KEY) return;
    const container = ref.current;
    // Canceled on unmount: the API loads asynchronously and React 18 mounts effects twice in
    // development, so a late resolve must not build a second map into a detached node.
    let canceled = false;
    let markers: google.maps.marker.AdvancedMarkerElement[] = [];

    void (async () => {
      try {
        setOptions({ key: API_KEY, v: "weekly", mapIds: [MAP_ID] });
        const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
        ]);
        if (canceled) return;

        // A map rebuilt for a theme change goes into the same node, so clear the old one out.
        container.replaceChildren();

        const map = new Map(container, {
          // `center` IS [lng, lat], the order maplibre-gl took and the order every dataset in
          // datasets.server.ts is written in (Broad Street is [-0.1367, 51.5132]). Google wants
          // { lat, lng }. The rewrite read them the other way round, so the first live render
          // opened in the Indian Ocean while the markers, which use named fields, sat in London.
          // toLatLng is that conversion, named and tested, rather than two indices inline.
          center: toLatLng(center),
          zoom,
          mapId: MAP_ID,
          // WHICH OF THE MAP ID'S TWO STYLES TO DRAW. The map ID carries a light style and a dark
          // style in the Cloud console (germomics-light, germomics-dark). Google reads this option
          // ONLY when the map is created; setting it later does nothing. That is why `dark` is a
          // dependency of this effect: a theme change rebuilds the map. A rebuild counts as one
          // more map load against the daily quota, which a visitor flipping the switch can afford.
          colorScheme: dark ? "DARK" : "LIGHT",
          // The old map carried a navigation control and nothing else. Keep the surface that
          // small: no street view, no map-type switcher, no fullscreen.
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const info = new InfoWindow();
        const add = (text: string, position: google.maps.LatLngLiteral, content: HTMLElement, zIndex: number) => {
          const marker = new AdvancedMarkerElement({ map, position, title: text, content, zIndex });
          marker.addListener("click", () => {
            // TEXT NODE, NOT A STRING. setContent(string) parses markup; setContent(Node) does
            // not. This is the one line that keeps dataset text out of the DOM as HTML.
            info.setContent(document.createTextNode(text));
            info.open({ map, anchor: marker });
          });
          markers.push(marker);
        };
        const dots = points.length > 20;
        for (const p of points) {
          const content = dots ? dot(p.value, dark) : new PinElement(dark ? PIN_DARK : PIN_LIGHT).element;
          add(`${p.label}: ${p.value}`, { lat: p.lat, lng: p.lng }, content, 1);
        }
        for (const l of landmarks) {
          const pin = new PinElement({ ...(dark ? LANDMARK_DARK : LANDMARK_LIGHT), scale: l.label === marked ? 1.3 : 0.8 });
          add(l.label, { lat: l.lat, lng: l.lng }, pin.element, l.label === marked ? 3 : 2);
        }
      } catch {
        // A blocked script, a bad key, or an offline browser. The data table below is the real
        // content, so this degrades to no map rather than to a broken page.
        if (!canceled) setFailed(true);
      }
    })();

    return () => {
      canceled = true;
      for (const marker of markers) marker.map = null;
      markers = [];
    };
  }, [center, zoom, points, landmarks, marked, dark]);

  return (
    <>
      {!failed && (
        <div ref={ref} aria-hidden className="h-80 w-full overflow-hidden rounded-xl border border-border" />
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {failed ? "Map unavailable. The table below gives its totals." : "Map data © Google."}
      </p>
    </>
  );
}
