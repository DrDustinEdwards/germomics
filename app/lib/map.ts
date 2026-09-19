// The pure logic behind app/components/data/DataMap.client.tsx, lifted out so it can be tested
// without loading the Maps JS API. NOTHING IN THIS FILE MAY IMPORT @googlemaps/js-api-loader or
// reach for the `google.maps` ambient namespace: the moment it does, the workers-pool suite can
// no longer load it and the map's one proven bug class goes back to being untestable.
//
// WHY IT EXISTS. On 2026-09-18 the map went live and opened in the Indian Ocean. Every dataset
// in datasets.server.ts writes `map.center` as [lng, lat], the order maplibre-gl took, and the
// Google rewrite read center[0] as the latitude. Typecheck passed, the build passed, and the
// suite said nothing, because both halves of a coordinate pair are plain numbers and a swapped
// pair is still two valid numbers. Only a named function has a contract a test can hold.

/** A dataset's `map.center`, in the [lng, lat] order datasets.server.ts is written in. */
export type LngLat = [number, number];

// [lng, lat] IN, { lat, lng } OUT. Doing this inline at the call site is what went wrong:
// `center[0]` reads as "the first one", where `toLatLng(center)` reads as the conversion it is.
export function toLatLng(center: LngLat): { lat: number; lng: number } {
  return { lat: center[1], lng: center[0] };
}

// THE SITE'S THEME, DECIDED THE WAY app.css DECIDES IT: an explicit data-theme on <html> wins in
// either direction, and with none set the system preference does. Anything else would let the
// map and the page disagree. Both inputs arrive as arguments rather than as reads of `document`
// and `window`, so the rule itself is testable; the component supplies them.
export function siteIsDark(chosenTheme: string | null | undefined, systemPrefersDark: boolean): boolean {
  if (chosenTheme === "dark") return true;
  if (chosenTheme === "light") return false;
  return systemPrefersDark;
}
