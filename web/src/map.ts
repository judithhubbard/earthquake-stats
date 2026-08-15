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
}

export interface MapOptions {
  land: LandFeature;
  events: MapEvent[];
  theme: Theme;
  width: number;
}

export function renderMap(opts: MapOptions): SVGSVGElement | HTMLElement {
  const { land, events, theme, width } = opts;
  const radius = (d: MapEvent) => 1.1 + Math.max(0, d.mag - 4) * 0.9;

  const marks: Plot.Markish[] = [
    Plot.geo({ type: "Sphere" } as never, { fill: theme.surface, stroke: theme.axis, strokeWidth: 0.6 }),
    Plot.graticule({ stroke: theme.grid, strokeWidth: 0.5, strokeOpacity: 0.7 }),
    Plot.geo(land as never, { fill: theme.band, stroke: theme.axis, strokeWidth: 0.4 }),
  ];

  marks.push(
    Plot.dot(events, {
      x: "lon", y: "lat", r: radius,
      fill: "color", fillOpacity: 0.8,
      stroke: theme.surface, strokeWidth: 0.4,
    }),
    Plot.tip(events, Plot.pointer({
      x: "lon", y: "lat", maxRadius: 18,
      fill: theme.surface, stroke: theme.axis, textPadding: 8, fontSize: 11,
      title: (d: MapEvent) =>
        `${d.year} · M${d.mag.toFixed(1)}\n` +
        `${Math.abs(d.lat).toFixed(1)}°${d.lat >= 0 ? "N" : "S"} ` +
        `${Math.abs(d.lon).toFixed(1)}°${d.lon >= 0 ? "E" : "W"}`,
    })),
  );

  return Plot.plot({
    width,
    projection: {
      type: PROJECTION_TYPE as never,
      domain: {
        type: "Polygon",
        coordinates: [[
          [-180, CLIP.latMin], [180, CLIP.latMin],
          [180, CLIP.latMax], [-180, CLIP.latMax], [-180, CLIP.latMin],
        ]],
      } as never,
    },
    style: { background: "transparent", color: theme.text, fontSize: "11px" },
    color: { type: "identity" },
    marks,
  });
}
