/**
 * Declustering for the live feed, in the browser.
 *
 * pipeline/nearest.py flags the M6+ catalog by nearest neighbour (Zaliapin &
 * Ben-Zion), but only when the site is rebuilt, which GitHub does every few
 * hours. Until then a fresh aftershock would count as a mainshock -- worst in
 * the hours after a great earthquake, which is exactly when people look. So
 * the page links each live event itself, with the same metric, the same
 * fitted threshold (meta.json carries it) and the same forward-only rule.
 *
 * Only M6+ events link to M6+ events, and the browser holds all of them, so
 * the result matches the pipeline's up to the binary's rounding (magnitude to
 * 0.1, location to 0.01 degrees); the next rebuild replaces it either way.
 *
 * Keep this in step with nearest.py.
 */

import type { Tier } from "./catalog";

const EARTH_RADIUS_KM = 6371.0;
const YEAR_MS = 365.25 * 86_400_000;

export interface NearestParams {
  minMagnitude: number;
  df: number;
  b: number;
  minDistanceKm: number;
  /** null until the pipeline has fitted it; nothing is linked then. */
  log10Eta0: number | null;
}

export interface Classifiable {
  time: number;
  lat: number;
  lon: number;
  depth: number;
  mag: number;
}

type Point = Classifiable;

/** The nearest-neighbour distance from a parent to a later child. */
function eta(parent: Point, child: Point, p: NearestParams): number {
  const dt = (child.time - parent.time) / YEAR_MS;
  if (dt <= 0) return Infinity;
  const r = Math.PI / 180;
  const sinLat = Math.sin(((child.lat - parent.lat) * r) / 2);
  const sinLon = Math.sin(((child.lon - parent.lon) * r) / 2);
  const a = sinLat * sinLat
    + Math.cos(parent.lat * r) * Math.cos(child.lat * r) * sinLon * sinLon;
  const epicentral = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  const dist = Math.max(p.minDistanceKm, Math.hypot(epicentral, child.depth - parent.depth));
  return dt * dist ** p.df * 10 ** (-p.b * parent.mag);
}

const tierPoint = (tier: Tier, i: number): Point => ({
  time: tier.time[i], lat: tier.lat[i], lon: tier.lon[i], depth: tier.depth[i], mag: tier.mag[i],
});

/**
 * Flags each live event as dependent (true) or a mainshock (false).
 *
 * `tier` must be the M6+ tier. A live event is dependent when its nearest
 * earlier neighbour is close enough to count as a link, and the chain of links
 * behind it holds an event at least as large -- so a big earthquake that
 * follows a smaller foreshock stays a mainshock, as in the pipeline.
 */
export function classifyLive<E extends Classifiable>(events: E[], tier: Tier,
                                                     p: NearestParams): Map<E, boolean> {
  const dependent = new Map<E, boolean>();
  if (p.log10Eta0 === null) {
    for (const e of events) dependent.set(e, false);
    return dependent;
  }
  const threshold = p.log10Eta0;
  const linked = (value: number) => value > 0 && Math.log10(value) < threshold;

  // The largest magnitude among a catalog event's linked ancestors, found by
  // walking back through nearest neighbours. Memoised: a chain is a handful
  // of links, each an O(n) scan, and the same ancestors recur.
  const memo = new Map<number, number>();
  const catalogChainMax = (k: number): number => {
    const known = memo.get(k);
    if (known !== undefined) return known;
    const child = tierPoint(tier, k);
    let best = Infinity, parent = -1;
    for (let i = 0; i < k; i++) {
      const value = eta(tierPoint(tier, i), child, p);
      if (value < best) { best = value; parent = i; }
    }
    const result = parent >= 0 && linked(best)
      ? Math.max(tier.mag[parent], catalogChainMax(parent)) : 0;
    memo.set(k, result);
    return result;
  };

  const order = [...events].sort((a, b) => a.time - b.time);
  const liveChainMax = new Map<E, number>();
  for (const [j, event] of order.entries()) {
    let best = Infinity;
    let chain = 0;
    for (let i = 0; i < tier.n && tier.time[i] < event.time; i++) {
      const value = eta(tierPoint(tier, i), event, p);
      if (value < best) { best = value; chain = -1 - i; }   // negative: a catalog index
    }
    for (let i = 0; i < j; i++) {
      const value = eta(order[i], event, p);
      if (value < best) { best = value; chain = i; }
    }
    let chainMax = 0;
    if (linked(best)) {
      chainMax = chain < 0
        ? Math.max(tier.mag[-1 - chain], catalogChainMax(-1 - chain))
        : Math.max(order[chain].mag, liveChainMax.get(order[chain]) ?? 0);
    }
    liveChainMax.set(event, chainMax);
    dependent.set(event, chainMax >= event.mag);
  }
  return dependent;
}
