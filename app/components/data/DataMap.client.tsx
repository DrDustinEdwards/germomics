// Heavy + window-only: imported ONLY via lazy() from data.$slug, so MapLibre is code-split to
// its own chunk and never touches the server or content bundles (CLAUDE.md rule #7). The map
// is decorative (aria-hidden) — the page's data table is the accessible equivalent.
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DataPoint } from "~/lib/datasets.server";

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

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://demotiles.maplibre.org/style.json",
      center,
      zoom,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    for (const p of points) {
      new maplibregl.Marker({ color: "#4F2D7F" })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(`${p.label}: ${p.value}`))
        .addTo(map);
    }
    return () => map.remove();
  }, [center, zoom, points]);

  return <div ref={ref} aria-hidden className="h-80 w-full overflow-hidden rounded-xl border border-border" />;
}
