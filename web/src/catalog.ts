/**
 * Loads the packed catalog tiers emitted by pipeline/build.py.
 *
 * The binary is a struct-of-arrays so each block can be wrapped in a typed
 * array view with no copying; see the module docstring in build.py for the
 * exact layout.
 */

export interface TierInfo {
  threshold: number;
  name: string;
  count: number;
  /** Events surviving declustering; equals `count` if it has not been run. */
  mainshocks: number;
  /**
   * Events whose magnitude is a published Mw rather than ComCat's preferred one.
   *
   * Read by the integrity check: this ran at 99.5% for M6+ and fell to 2.9%
   * when the harvest was skipped, which put the pre-1984 counts on a different
   * magnitude scale from everything after. See integrity.ts.
   */
  homogenised: number;
  /** Whether a `<name>.detail.json` sidecar of ids and place names exists. */
  hasDetail: boolean;
  bytes: number;
  firstTime: number | null;
  lastTime: number | null;
}

export interface Encoding {
  timeUnit: string;
  latLonScale: number;
  depthOffsetKm: number;
  depthScale: number;
  magScale: number;
  /** Low bits of the magnitude byte that hold the magnitude itself. */
  magMask: number;
  /** High bit of the magnitude byte, set on dependent (clustered) events. */
  dependentFlag: number;
}

export interface RecentEvent {
  id: string;
  time: number;
  lat: number;
  lon: number;
  depth: number | null;
  mag: number;
  magtype: string | null;
  place: string | null;
}

export interface Meta {
  generated: string;
  source: string;
  minMagnitude: number;
  eventType: string;
  /** False if pipeline/decluster.py has not been run against this mirror. */
  declustered: boolean;
  encoding: Encoding;
  tiers: TierInfo[];
  recent: RecentEvent[];
}

/** A decoded magnitude tier. Parallel arrays, ordered by time ascending. */
export interface Tier {
  info: TierInfo;
  n: number;
  /** Epoch milliseconds. */
  time: Float64Array;
  lat: Float32Array;
  lon: Float32Array;
  depth: Float32Array;
  mag: Float32Array;
  /** 1 where the event was flagged as an aftershock or foreshock. */
  dependent: Uint8Array;
}

const MS_PER_MIN = 60_000;

/**
 * Where the emitted data lives.
 *
 * BASE_URL is "/" for a root deploy and "/repo/" for a GitHub project page, so
 * every fetch has to go through it. Hard-coding "/data" works locally and then
 * 404s the moment the site is served from a subdirectory.
 */
export const DATA_BASE = `${import.meta.env.BASE_URL}data`;

/**
 * The catalog's parts are separate files with separate cache lifetimes, so a
 * browser can hold a new meta.json beside an old tier, or the reverse. The
 * sizes then disagree and the page fails to draw -- which is what happened when
 * the catalog was rebuilt underneath open tabs.
 *
 * Every tier request carries the build stamp from meta.json, so a rebuild asks
 * for URLs nothing has cached, and a stale body cannot be served against a
 * fresh manifest. meta.json itself is fetched no-store: it is 4 KB and it is
 * the thing that decides whether anything else needs refetching.
 */
function versioned(base: string, file: string, meta?: Meta): string {
  return meta ? `${base}/${file}?v=${encodeURIComponent(meta.generated)}` : `${base}/${file}`;
}

export async function loadMeta(base = DATA_BASE): Promise<Meta> {
  const res = await fetch(`${base}/meta.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`meta.json: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function loadTier(info: TierInfo, encoding: Encoding,
                              base = DATA_BASE, meta?: Meta): Promise<Tier> {
  const res = await fetch(versioned(base, `${info.name}.bin`, meta));
  if (!res.ok) throw new Error(`${info.name}.bin: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return decode(buf, info, encoding);
}

export function decode(buf: ArrayBuffer, info: TierInfo, encoding: Encoding): Tier {
  const n = info.count;
  const expected = n * 11;
  if (buf.byteLength !== expected) {
    throw new Error(`${info.name}.bin is ${buf.byteLength} bytes, expected ${expected}`);
  }

  const rawTime = new Uint32Array(buf, 0, n);
  const rawLat = new Int16Array(buf, 4 * n, n);
  const rawLon = new Int16Array(buf, 6 * n, n);
  const rawDepth = new Uint16Array(buf, 8 * n, n);
  const rawMag = new Uint8Array(buf, 10 * n, n);

  const time = new Float64Array(n);
  const lat = new Float32Array(n);
  const lon = new Float32Array(n);
  const depth = new Float32Array(n);
  const mag = new Float32Array(n);
  const dependent = new Uint8Array(n);

  const magMask = encoding.magMask ?? 0x7f;
  const dependentFlag = encoding.dependentFlag ?? 0x80;

  for (let i = 0; i < n; i++) {
    time[i] = rawTime[i] * MS_PER_MIN;
    lat[i] = rawLat[i] / encoding.latLonScale;
    lon[i] = rawLon[i] / encoding.latLonScale;
    depth[i] = rawDepth[i] / encoding.depthScale - encoding.depthOffsetKm;
    mag[i] = (rawMag[i] & magMask) / encoding.magScale;
    dependent[i] = (rawMag[i] & dependentFlag) !== 0 ? 1 : 0;
  }

  return { info, n, time, lat, lon, depth, mag, dependent };
}

/** Event ids and place names, parallel to a tier's binary ordering. */
export interface TierDetail {
  ids: string[];
  places: string[];
}

/** Caches tiers so switching magnitude back and forth costs one fetch each. */
export class CatalogStore {
  private readonly cache = new Map<string, Promise<Tier>>();
  private readonly details = new Map<string, Promise<TierDetail>>();

  constructor(private readonly meta: Meta, private readonly base = DATA_BASE) {}

  /**
   * The finest tier at or above `threshold` that carries a detail sidecar.
   *
   * Selecting M5+ still lists M6+ events as "largest", because the M5 sidecar
   * would be megabytes of place names to surface six rows.
   */
  detailTierFor(threshold: number): TierInfo | null {
    const candidates = this.meta.tiers
      .filter((t) => t.hasDetail && t.threshold >= threshold - 1e-9)
      .sort((a, b) => a.threshold - b.threshold);
    return candidates[0] ?? null;
  }

  loadDetail(info: TierInfo): Promise<TierDetail> {
    let pending = this.details.get(info.name);
    if (!pending) {
      pending = fetch(versioned(this.base, `${info.name}.detail.json`, this.meta))
        .then((res) => {
        if (!res.ok) throw new Error(`${info.name}.detail.json: ${res.status}`);
        return res.json();
      });
      this.details.set(info.name, pending);
      // Evicted if it fails. A cached rejection is permanent: every later call
      // gets the same stored failure, so one dropped connection broke an open
      // tab for as long as it stayed open, through 1,440 retries a day.
      pending.catch(() => this.details.delete(info.name));
    }
    return pending;
  }

  /**
   * Every selectable threshold must have its own emitted tier.
   *
   * Magnitudes are quantised to 0.1 in the binary, so filtering a coarser tier
   * down to a finer threshold would misclassify events at the boundary -- the
   * six events between M6.95 and M7.0 round up to 7.0 and would be counted as
   * M7+ that ComCat does not consider M7+. Tier thresholds are applied in SQL
   * against full-precision magnitudes, so an exact match is always correct.
   * To offer a new threshold, add it to TIERS in pipeline/build.py.
   */
  tierFor(threshold: number): TierInfo {
    const exact = this.meta.tiers.find((t) => Math.abs(t.threshold - threshold) < 1e-9);
    if (!exact) {
      const available = this.meta.tiers.map((t) => `M${t.threshold}`).join(", ");
      throw new Error(`no tier emitted for M${threshold}+ (have: ${available})`);
    }
    return exact;
  }

  load(threshold: number): Promise<Tier> {
    const info = this.tierFor(threshold);
    let pending = this.cache.get(info.name);
    if (!pending) {
      pending = loadTier(info, this.meta.encoding, this.base, this.meta);
      this.cache.set(info.name, pending);
      // See loadDetail: a rejection must not become the cached answer.
      pending.catch(() => this.cache.delete(info.name));
    }
    return pending;
  }
}
