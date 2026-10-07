/**
 * Checks the catalog before the page draws anything from it.
 *
 * This exists because of a real regression. On 19 August 2026 a change to the
 * CI cache key missed, the pipeline rebuilt its mirror from scratch, and the
 * routine moment-magnitude harvest only covered the last two years -- so every
 * earlier event fell back to ComCat's preferred magnitude, which changes kind
 * around 1984. M6+ went from 99.5% homogenised to 2.9%, the 1970s lost about a
 * quarter of their earthquakes, and the site published wrong numbers for two
 * days without anything noticing.
 *
 * The pipeline now refuses to publish a catalog that fails this. That guard
 * cannot help if a stale copy is cached at the edge, if someone deploys by
 * hand, or if a future change breaks the harvest in a way CI does not run. So
 * the browser checks too, and says so on the page rather than quietly drawing
 * a chart that is wrong.
 */
import type { Meta } from "./catalog";

/** M6+ sits at 99.5% when the harvest has run. Anything under this is broken. */
const MIN_HOMOGENISED = 0.9;

/**
 * A catalog older than this is about to leave a gap.
 *
 * The browser reads the USGS one-day feed itself, which reaches back exactly 24
 * hours, so nothing is missing until the catalog is a day old -- and the banner
 * says things are missing. Twenty hours leaves the warning ahead of the gap.
 *
 * It was six, on the theory that the workflow rebuilds every fifteen minutes.
 * GitHub runs that schedule every three to eight hours, so six raised a false
 * "totals are too low" on an ordinary afternoon. Three days, before that, was
 * wrong the other way: 48 hours of events in neither the catalog nor the feed.
 */
const MAX_AGE_HOURS = 20;

export function checkCatalog(meta: Meta, now = Date.now()): string | null {
  const tier = meta.tiers.find((t) => t.threshold === 6);
  if (!tier || !tier.count) return "The M6+ catalog is empty.";

  const share = (tier.homogenised ?? 0) / tier.count;
  if (share < MIN_HOMOGENISED) {
    return `Only ${Math.round(100 * share)}% of M6+ earthquakes carry a moment magnitude, `
      + "so the counts before about 1984 are on a different scale from the ones after and "
      + "cannot be compared. The numbers on this page are wrong until the catalog rebuilds.";
  }

  // Date.parse returning NaN made every comparison false, which switched the
  // staleness check off altogether -- the one failure a malformed stamp is most
  // likely to accompany.
  const built = Date.parse(meta.generated);
  if (!Number.isFinite(built)) {
    return "The catalog does not say when it was built, so there is no way to tell whether "
      + "the earthquakes below are current.";
  }

  const hours = (now - built) / 3_600_000;
  if (hours > MAX_AGE_HOURS) {
    const age = hours < 48
      ? `${Math.round(hours)} hours`
      : `${Math.round(hours / 24)} days`;
    return `The catalog was last rebuilt ${age} ago, and should rebuild several `
      + "times a day. Earthquakes since then are missing from the counts and charts below, so "
      + "this year's totals are too low.";
  }
  return null;
}

/** Puts the problem at the top of the page, above everything it affects. */
export function showProblem(message: string) {
  const box = document.createElement("p");
  box.className = "integrity";
  box.textContent = message;
  document.querySelector("main")?.prepend(box);
}
