/**
 * Where the selected years' earthquakes happened, coloured to match their
 * lines on the charts above.
 *
 * This once carried a region filter drawn as a lat/lon box. That was removed
 * along with the region selector; if it comes back, note that d3-geo reads a
 * spherical polygon's interior from its winding direction, and the intuitive
 * winding made a box cover 12.38 of the sphere's 12.57 steradians -- it filled
 * the world and punched the region out as a hole. Reverse the ring, and
 * subdivide its edges so they follow parallels instead of great circles.
 */

import * as Plot from "@observablehq/plot";
import * as topojson from "topojson-client";
import type { Theme } from "./chart";

/**
 * Equal Earth, because the question the map answers is how much seismicity an
 * area has, and only an equal-area projection lets a cluster of dots mean the
 * same thing wherever it sits. Mercator would inflate the Aleutians and Chile
 * against the tropics; that is the opposite of useful here.
 *
 * The clip band must contain the whole catalogue -- M6+ reaches 85°N -- since
 * a tighter band silently drops dots the captions still count.
 */
const PROJECTION_TYPE = "equal-earth";
const CLIP = { latMin: -78, latMax: 88 };

/**
 * Central meridian, so the Pacific sits in the middle and the Ring of Fire is
 * one continuous arc instead of being cut in half by the frame edge.
 *
 * 170°E puts the seam at 10°W, which is the least damaging place for it: east
 * of Greenland's eastern tip (11.7°W) and west of continental Europe, so the
 * only land it crosses is West Africa. The obvious choice of 180° would put the
 * seam on the prime meridian and split Britain, France and Spain down the
 * middle.
 */
const CENTRE_LON = 170;

type LandFeature = { type: string; [key: string]: unknown };
let landPromise: Promise<LandFeature> | null = null;

/**
 * Coastlines are loaded on demand and cached; Vite emits the TopoJSON as its
 * own chunk, so the initial page load does not carry it.
 */
export function loadLand(): Promise<LandFeature> {
  landPromise ??= import("world-atlas/land-110m.json")
    .then((mod) => {
      // The TopoJSON ships without useful types; one contained cast beats
      // threading Topology generics through for a single known-shape file.
      const topology = ((mod as { default?: unknown }).default ?? mod) as never;
      const objects = (topology as unknown as { objects: { land: never } }).objects;
      return topojson.feature(topology, objects.land) as unknown as LandFeature;
    });
  return landPromise;
}

export interface MapEvent {
  lat: number;
  lon: number;
  mag: number;
  year: number;
  color: string;
  /**
   * Join key for the event list beside the map.
   *
   * The two are built by different routes -- the map straight from the packed
   * arrays, the list from the detail file -- so they need something both carry.
   * Origin time to the millisecond is unique across the catalogue and is the
   * one field neither path can lose.
   */
  time: number;
}

export interface MapOptions {
  land: LandFeature;
  events: MapEvent[];
  theme: Theme;
  width: number;
}

export function renderMap(opts: MapOptions): SVGSVGElement | HTMLElement {
  const { land, events, theme, width } = opts;
  // Pixels, not scale units: the plot declares r as an identity scale, so what
  // this returns is what gets drawn. Left to Plot, r is a sqrt scale fitted to
  // whatever magnitudes happen to be on screen, which renormalises -- scaling
  // every dot up by a constant would then change nothing at all.
  const radius = (d: MapEvent) => 1.8 + Math.max(0, d.mag - 4) * 1.4;

  const marks: Plot.Markish[] = [
    Plot.geo({ type: "Sphere" } as never,
             { fill: theme.mapOcean, stroke: theme.mapCoast, strokeWidth: 0.6 }),
    // Drawn under the land so it reads as ocean rule rather than a grid over
    // the continents, which competes with the dots.
    Plot.graticule({ stroke: theme.mapCoast, strokeWidth: 0.4, strokeOpacity: 0.45 }),
    Plot.geo(land as never, { fill: theme.mapLand, stroke: theme.mapCoast, strokeWidth: 0.5 }),
  ];

  marks.push(
    // sort: null because the dot mark otherwise reorders by descending radius
    // of its own accord, and the list beside the map is joined to these circles
    // by their position in this array. `events` arrives already in that order,
    // so the drawing order is unchanged -- it is now ours rather than Plot's.
    Plot.dot(events, {
      x: "lon", y: "lat", r: radius, sort: null,
      fill: "color", fillOpacity: 0.8,
      stroke: theme.surface, strokeWidth: 0.4,
    }),
    Plot.tip(events, Plot.pointer({
      x: "lon", y: "lat", maxRadius: 18,
      fill: theme.surface, stroke: theme.axis, textPadding: 12, fontSize: 16,
      title: (d: MapEvent) =>
        `M${d.mag.toFixed(1)}\n` +
        new Date(d.time).toLocaleDateString(undefined, {
          day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
        }),
    })),
  );

  return Plot.plot({
    width,
    projection: {
      type: PROJECTION_TYPE as never,
      rotate: [-CENTRE_LON, 0],
      // The clip box is given in rotated coordinates, so its corners are the
      // frame edges rather than the antimeridian: a box still written as
      // -180..180 of true longitude would be a half-turn out and clip the
      // Pacific away.
      domain: {
        type: "Polygon",
        coordinates: [[
          [CENTRE_LON - 180, CLIP.latMin], [CENTRE_LON - 90, CLIP.latMin],
          [CENTRE_LON, CLIP.latMin], [CENTRE_LON + 90, CLIP.latMin],
          [CENTRE_LON + 179.99, CLIP.latMin],
          [CENTRE_LON + 179.99, CLIP.latMax], [CENTRE_LON + 90, CLIP.latMax],
          [CENTRE_LON, CLIP.latMax], [CENTRE_LON - 90, CLIP.latMax],
          [CENTRE_LON - 180, CLIP.latMax], [CENTRE_LON - 180, CLIP.latMin],
        ]],
      } as never,
    },
    style: { background: "transparent", color: theme.text, fontSize: "11px" },
    color: { type: "identity" },
    r: { type: "identity" },
    marks,
  });
}
