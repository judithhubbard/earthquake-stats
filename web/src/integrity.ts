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

/** A catalog older than this is not being rebuilt; it publishes every 15 min. */
const MAX_AGE_DAYS = 3;

export function checkCatalog(meta: Meta, now = Date.now()): string | null {
  const tier = meta.tiers.find((t) => t.threshold === 6);
  if (!tier || !tier.count) return "The M6+ catalog is empty.";

  const share = (tier.homogenised ?? 0) / tier.count;
  if (share < MIN_HOMOGENISED) {
    return `Only ${Math.round(100 * share)}% of M6+ earthquakes carry a moment magnitude, `
      + "so the counts before about 1984 are on a different scale from the ones after and "
      + "cannot be compared. The numbers on this page are wrong until the catalog rebuilds.";
  }

  const age = (now - Date.parse(meta.generated)) / 86_400_000;
  if (age > MAX_AGE_DAYS) {
    return `The catalog was last rebuilt ${Math.round(age)} days ago, and should rebuild `
      + "every fifteen minutes. Recent earthquakes may be missing.";
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
