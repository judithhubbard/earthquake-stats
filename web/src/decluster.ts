/**
 * Declustering for the live feed, in the browser.
 *
 * pipeline/decluster.py flags the catalog, but only when the site is rebuilt,
 * and GitHub runs the rebuild every few hours rather than on its 15-minute
 * schedule. Until then a fresh aftershock was counted as a mainshock -- worst
 * in the hours after a great earthquake, which is exactly when people look.
 *
 * The page can do the same job itself, exactly, because of how the windows
 * work: an event is claimed only by an earlier mainshock at least as large.
 * Whether an M6+ event is a mainshock therefore depends on M6+ events alone,
 * and the browser already holds all of them with their flags. Smaller events
 * never enter into it.
 *
 * Keep the formulas in step with decluster.py. They differ from it only in
 * that catalog magnitudes here are quantised to 0.1 and live ones are USGS's
 * preferred magnitude rather than a harvested Mw; the next rebuild replaces
 * whatever this decides.
 */

import type { Tier } from "./catalog";

const DAY_MS = 86_400_000;
const EARTH_RADIUS_KM = 6371.0;

/** Aftershock-zone radius in km: Gardner-Knopoff, widened to 2x Wells & Coppersmith RLD. */
export function spaceWindowKm(mag: number): number {
  const gardnerKnopoff = 10 ** (0.1238 * mag + 0.983);
  const ruptureLength = 10 ** (0.58 * mag - 2.42);
  return Math.max(gardnerKnopoff, 2 * ruptureLength);
}

/** Gardner & Knopoff time window, unmodified. */
export function timeWindowDays(mag: number): number {
  return mag >= 6.5 ? 10 ** (0.032 * mag + 2.7389) : 10 ** (0.5409 * mag - 0.547);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const sinDLat = Math.sin((lat2 - lat1) * r * 0.5);
  const sinDLon = Math.sin((lon2 - lon1) * r * 0.5);
  const a = sinDLat * sinDLat
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Whether a mainshock at (time, lat, lon, mag) claims a later event. */
function claims(time: number, lat: number, lon: number, mag: number,
                target: { time: number; lat: number; lon: number; mag: number }): boolean {
  if (mag < target.mag || time > target.time) return false;
  if (target.time - time > timeWindowDays(mag) * DAY_MS) return false;
  return distanceKm(lat, lon, target.lat, target.lon) <= spaceWindowKm(mag);
}

export interface Classifiable {
  time: number;
  lat: number;
  lon: number;
  mag: number;
}

/**
 * Flags each live event as dependent (true) or a mainshock (false).
 *
 * `tier` must reach down to the smallest live magnitude being classified --
 * the M6+ tier for everything the page offers. Live events all postdate the
 * catalog, and windows run forward only, so nothing live can change a
 * catalog event's flag; only the reverse needs checking.
 *
 * Live events are taken largest first, as decluster.py takes everything, and
 * ties go to the earlier event -- so a live M7 claims its own live aftershocks,
 * but only if the catalog had not already claimed the M7.
 */
export function classifyLive<E extends Classifiable>(events: E[], tier: Tier): Map<E, boolean> {
  const dependent = new Map<E, boolean>();
  const order = [...events].sort((a, b) => b.mag - a.mag || a.time - b.time);
  const earliest = Math.min(...events.map((e) => e.time))
    - timeWindowDays(10) * DAY_MS;

  for (const event of order) {
    let claimed = false;
    for (let i = tier.n - 1; i >= 0 && tier.time[i] >= earliest; i--) {
      if (tier.dependent[i]) continue;
      if (claims(tier.time[i], tier.lat[i], tier.lon[i], tier.mag[i], event)) {
        claimed = true;
        break;
      }
    }
    if (!claimed) {
      for (const [other, otherDependent] of dependent) {
        if (otherDependent || other === event) continue;
        if (claims(other.time, other.lat, other.lon, other.mag, event)) {
          claimed = true;
          break;
        }
      }
    }
    dependent.set(event, claimed);
  }
  return dependent;
}
