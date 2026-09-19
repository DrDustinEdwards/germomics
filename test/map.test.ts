import { describe, expect, it } from "vitest";
import { siteIsDark, toLatLng } from "~/lib/map";
import { getDataset, listDatasets } from "~/lib/datasets.server";

// THE TEST THE OCEAN BUG NEEDED.
//
// On 2026-09-18 the /data map went live and opened in the Indian Ocean: datasets.server.ts
// writes `map.center` as [lng, lat] and the Google rewrite read center[0] as the latitude.
// Typecheck was clean, the build was clean, and the 33-test suite was silent, because a swapped
// coordinate pair is still two numbers of the right type. These are the three pieces of pure
// logic behind app/components/data/DataMap.client.tsx, pinned so the next rewrite of it goes red
// here instead of on the live page.
//
// NO google.maps MOCK ANYWHERE IN THIS FILE, deliberately. Asserting that `new Map()` was called
// with certain options tests the mock, not the map: the constructor would happily accept the
// swapped center and a fake would report it as a pass. What would actually cover the rendering
// is a browser runner (Playwright against a built page, with a real API key and a real quota),
// which is a different piece of infrastructure and is not in scope here.

describe("toLatLng", () => {
  it("reads a dataset's [lng, lat] into Google's { lat, lng }", () => {
    // Broad Street, the exact center that opened in the wrong ocean. 51.5 is a latitude and
    // -0.13 is a longitude, so the two orders are 51 degrees apart on the globe.
    expect(toLatLng([-0.1367, 51.5132])).toEqual({ lat: 51.5132, lng: -0.1367 });
  });

  it("keeps the sign of each coordinate with its own axis", () => {
    // Southern and western at once, so a swap cannot be hidden by a symmetric fixture.
    expect(toLatLng([-58.3816, -34.6037])).toEqual({ lat: -34.6037, lng: -58.3816 });
  });
});

// A center may sit off its points on purpose (a wider frame, a deliberate offset), but not by
// much, and never by the tens of degrees a swap produces. Five is loose enough to leave framing
// alone and tight enough that no swapped pair on Earth survives it: swapping moves a coordinate
// by |lat - lng|, and a dataset where that is under 5 degrees would have to sit within a few
// hundred kilometres of where the equator crosses the prime meridian.
const BOX_DEGREES = 5;

describe("every dataset's map center", () => {
  // Enumerated through the module's own two read points rather than a hand-kept list, so a
  // dataset added later is covered the day it lands instead of the day somebody remembers.
  const mapped = listDatasets().flatMap((entry) => {
    const dataset = getDataset(entry.slug);
    return dataset && dataset.map ? [{ slug: dataset.slug, map: dataset.map }] : [];
  });

  it("finds at least one dataset with a map, so the cases below are not vacuous", () => {
    expect(mapped.length).toBeGreaterThan(0);
  });

  for (const { slug, map } of mapped) {
    describe(slug, () => {
      const center = toLatLng(map.center);

      it("is a coordinate that exists", () => {
        // This one alone would NOT have caught the ocean: Broad Street swapped is
        // { lat: -0.1367, lng: 51.5132 }, and both of those are in range. It is here to catch
        // the other mistake, a center typed with a degree value out of bounds entirely.
        expect(center.lat).toBeGreaterThanOrEqual(-90);
        expect(center.lat).toBeLessThanOrEqual(90);
        expect(center.lng).toBeGreaterThanOrEqual(-180);
        expect(center.lng).toBeLessThanOrEqual(180);
      });

      it("has points to be centered on", () => {
        expect(map.points.length).toBeGreaterThan(0);
      });

      it(`sits within ${BOX_DEGREES} degrees of its own points`, () => {
        // THE CASE THAT CATCHES A SWAP. The markers use named p.lat / p.lng and were always
        // right, so the center drifting away from them is exactly the shape of the bug.
        const lats = map.points.map((p) => p.lat);
        const lngs = map.points.map((p) => p.lng);
        const box = {
          minLat: Math.min(...lats) - BOX_DEGREES,
          maxLat: Math.max(...lats) + BOX_DEGREES,
          minLng: Math.min(...lngs) - BOX_DEGREES,
          maxLng: Math.max(...lngs) + BOX_DEGREES,
        };
        expect(center.lat, `${slug} center latitude is nowhere near its markers`).toBeGreaterThanOrEqual(box.minLat);
        expect(center.lat, `${slug} center latitude is nowhere near its markers`).toBeLessThanOrEqual(box.maxLat);
        expect(center.lng, `${slug} center longitude is nowhere near its markers`).toBeGreaterThanOrEqual(box.minLng);
        expect(center.lng, `${slug} center longitude is nowhere near its markers`).toBeLessThanOrEqual(box.maxLng);
      });
    });
  }
});

describe("siteIsDark", () => {
  it("an explicit dark theme wins over a light system", () => {
    expect(siteIsDark("dark", false)).toBe(true);
  });

  it("an explicit light theme wins over a dark system", () => {
    expect(siteIsDark("light", true)).toBe(false);
  });

  it("with no explicit theme, the system decides, both ways", () => {
    expect(siteIsDark(null, true)).toBe(true);
    expect(siteIsDark(null, false)).toBe(false);
  });

  it("an attribute value that is neither light nor dark falls through to the system", () => {
    // getAttribute returns whatever the markup holds, and app.css only recognises the two
    // names: a stray value has to behave as though nothing were set, not as though it were dark.
    expect(siteIsDark("", true)).toBe(true);
    expect(siteIsDark("sepia", false)).toBe(false);
    expect(siteIsDark(undefined, true)).toBe(true);
  });
});
