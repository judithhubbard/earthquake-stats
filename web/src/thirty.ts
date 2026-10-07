/**
 * The 30-day view's arithmetic.
 *
 * The yearly view compares the last 365 days with the same 365 days in each
 * earlier year -- 49 peers. Thirty days does not work that way: 49 peers at
 * around 11 earthquakes each gives percentile edges that jump a whole band on
 * one event. So a 30-day stretch is ranked against every other 30-day stretch
 * in the record, one ending on each day -- about 18,000 -- leaving out only the
 * ones that overlap it. Earthquakes keep no calendar, so a stretch in March
 * is a fair peer for one in October.
 *
 * Overlapping peers are fine for a percentile, which is a statement about the
 * shape of the record. They would not be for a significance test, and nothing
 * here is one.
 */

import type { Tier } from "./catalog";

export const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export interface Daily {
  /** Epoch ms of day 0, UTC midnight. */
  start: number;
  /** Earthquakes per UTC day, aftershocks included. */
  all: Int32Array;
  /** The same with dependent events left out. */
  main: Int32Array;
}

export interface Countable {
  time: number;
  mag: number;
  dependent: boolean;
}

export const dayOf = (start: number, ms: number) => Math.floor((ms - start) / DAY_MS);

/**
 * Per-day counts from `start` through `lastDay`, catalog and live events both.
 * Live events already in the catalog are the caller's to drop.
 */
export function dailyCounts(tier: Tier, minMag: number, start: number, lastDay: number,
                            live: Countable[]): Daily {
  const all = new Int32Array(lastDay + 1);
  const main = new Int32Array(lastDay + 1);
  const add = (ms: number, dependent: boolean) => {
    const d = dayOf(start, ms);
    if (d < 0 || d > lastDay) return;
    all[d]++;
    if (!dependent) main[d]++;
  };
  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] >= minMag) add(tier.time[i], tier.dependent[i] === 1);
  }
  for (const e of live) if (e.mag >= minMag) add(e.time, e.dependent);
  return { start, all, main };
}

/** The count in the 30 days ending on each day; NaN before the first full one. */
export function windowSums(daily: Int32Array): Float64Array {
  const out = new Float64Array(daily.length).fill(NaN);
  let sum = 0;
  for (let d = 0; d < daily.length; d++) {
    sum += daily[d];
    if (d >= WINDOW_DAYS) sum -= daily[d - WINDOW_DAYS];
    if (d >= WINDOW_DAYS - 1) out[d] = sum;
  }
  return out;
}

/**
 * The stretches a reading is ranked against: every complete one that shares
 * no day with it. `lastComplete` is the last day whose window has finished --
 * yesterday, live -- so a stretch still running is never a peer.
 */
function peerDays(end: number, lastComplete: number): (d: number) => boolean {
  return (d) => d >= WINDOW_DAYS - 1 && d <= lastComplete
    && (d <= end - WINDOW_DAYS || d - (WINDOW_DAYS - 1) > end);
}

export interface Reading {
  now: number;
  /** Peer counts, ascending. */
  peers: number[];
  /** Mid-rank percentile: ties count half. */
  pct: number;
  /** Share of peers with more, 0-100. */
  above: number;
  median: number;
  p5: number; p25: number; p75: number; p95: number;
}

const quantile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

function lowerBound(sorted: number[], v: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

/** Where a count sits among the peers, ties counted half. */
export function percentileOf(v: number, sorted: number[]): number {
  const below = lowerBound(sorted, v);
  const equal = lowerBound(sorted, v + 1) - below;
  return (100 * (below + equal / 2)) / sorted.length;
}

export function reading(sums: Float64Array, end: number, lastComplete: number): Reading | null {
  const isPeer = peerDays(end, lastComplete);
  const peers: number[] = [];
  for (let d = 0; d < sums.length; d++) if (isPeer(d)) peers.push(sums[d]);
  const now = sums[end];
  if (peers.length < 100 || !Number.isFinite(now)) return null;
  peers.sort((a, b) => a - b);
  return {
    now, peers,
    pct: percentileOf(now, peers),
    above: Math.round((100 * (peers.length - lowerBound(peers, now + 1))) / peers.length),
    median: quantile(peers, 0.5),
    p5: quantile(peers, 0.05), p25: quantile(peers, 0.25),
    p75: quantile(peers, 0.75), p95: quantile(peers, 0.95),
  };
}

/**
 * The counts each answer covers, lowest band first, as [first, last] pairs or
 * null for a band no whole count lands in.
 *
 * Every count is placed by `bandOf(percentileOf(count))` -- the rule that
 * picks the headline -- so the row the table marks and the answer printed
 * above it cannot disagree. Edges read off the quantiles instead put 5 in
 * "5 or fewer" while 5 itself answered "on the quiet side".
 */
export function bandRanges(peers: number[], bandOf: (pct: number) => number,
                           bands: number, upTo: number): ([number, number] | null)[] {
  const out: ([number, number] | null)[] = Array.from({ length: bands }, () => null);
  for (let v = 0; v <= upTo; v++) {
    const b = bandOf(percentileOf(v, peers));
    const r = out[b];
    out[b] = r ? [r[0], v] : [v, v];
  }
  return out;
}

/**
 * How many separate spells a year reach at least this quiet (or busy).
 *
 * A quiet spell keeps the 30-day count low for days on end as the window
 * slides, so days are the wrong unit: 3.6% of days is 13 a year, but those 13
 * are one spell. Qualifying days within 30 of each other are one spell. Zero
 * means no other stretch in the record got there.
 */
export function spellsPerYear(sums: Float64Array, end: number, lastComplete: number,
                              now: number, quiet: boolean): number {
  const isPeer = peerDays(end, lastComplete);
  let spells = 0, previous = -Infinity, days = 0;
  for (let d = 0; d < sums.length; d++) {
    if (!isPeer(d)) continue;
    days++;
    if (quiet ? sums[d] <= now : sums[d] >= now) {
      if (d - previous > WINDOW_DAYS) spells++;
      previous = d;
    }
  }
  return days ? spells / (days / 365.25) : 0;
}
