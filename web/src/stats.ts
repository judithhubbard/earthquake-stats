/**
 * Cumulative-count statistics for the year-over-year chart.
 *
 * Every year is projected onto a common 365-point grid by elapsed fraction of
 * the year, so leap years neither stretch the axis nor create a phantom day 366.
 */

import type { Tier } from "./catalog";

export const DAYS = 365;

/**
 * The site reports one threshold and one reference window, deliberately.
 *
 * Magnitude, region and reference-period selectors all existed and were removed:
 * each one let a reader wander into a part of the catalogue where completeness
 * changes over time, and every such view needed its own caveat. M6+ globally is
 * the level at which ComCat is complete and comparable across decades.
 */
export const MIN_MAGNITUDE = 6;

/** Threshold whose share of each year is drawn as the darker part of a bar. */
export const MAJOR_MAGNITUDE = 7;

/** Elapsed fraction of the year, as an index 0..364. Leap-safe. */
export function dayIndex(ms: number): { year: number; day: number } {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const frac = (ms - start) / (end - start);
  return { year, day: Math.min(DAYS - 1, Math.max(0, Math.floor(frac * DAYS))) };
}

/** Calendar date at a day index, in a non-leap reference year (for axis labels). */
export function dayIndexToDate(day: number, year = 2001): Date {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return new Date(start + (day / DAYS) * (end - start));
}

export interface YearCurves {
  /** Year -> cumulative count at each day index. */
  curves: Map<number, Float64Array>;
  years: number[];
  /** Total events matching the filter. */
  matched: number;
}

export type Measure = "count" | "moment";

/**
 * Moment is stored in units of 10^20 N·m so the axis carries human-sized
 * numbers: a quiet year is a few units, 2004 and 2011 are in the hundreds.
 */
export const MOMENT_UNIT = 1e20;

/** Scalar seismic moment from moment magnitude (Hanks & Kanamori), in MOMENT_UNIT. */
export function seismicMoment(mag: number): number {
  return Math.pow(10, 1.5 * mag + 9.1) / MOMENT_UNIT;
}

/** Magnitude of the single earthquake that would release this much moment. */
export function equivalentMagnitude(moment: number): number {
  if (moment <= 0) return NaN;
  return (Math.log10(moment * MOMENT_UNIT) - 9.1) / 1.5;
}

export function cumulativeByYear(tier: Tier, minMag: number, minYear: number,
                                 mainshocksOnly = false,
                                 measure: Measure = "count"): YearCurves {
  const daily = new Map<number, Float64Array>();
  let matched = 0;

  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] < minMag) continue;
    if (mainshocksOnly && tier.dependent[i]) continue;
    const { year, day } = dayIndex(tier.time[i]);
    if (year < minYear) continue;
    let bucket = daily.get(year);
    if (!bucket) {
      bucket = new Float64Array(DAYS);
      daily.set(year, bucket);
    }
    bucket[day] += measure === "moment" ? seismicMoment(tier.mag[i]) : 1;
    matched++;
  }

  for (const bucket of daily.values()) {
    for (let d = 1; d < DAYS; d++) bucket[d] += bucket[d - 1];
  }

  return {
    curves: daily,
    years: [...daily.keys()].sort((a, b) => a - b),
    matched,
  };
}

export interface AnnualCount {
  year: number;
  count: number;
  /** The M7+ share of `count`, drawn as the darker part of the bar. */
  major: number;
  /** True for a year still in progress; `count` is then a partial total. */
  partial: boolean;
  /** For a partial year, where it lands if the rest matches the reference pace. */
  projected: number;
}

/**
 * Per-year totals for the annual chart.
 *
 * The current year is marked partial and carries a projection, because drawing
 * eight months of counting next to full years would read as a collapse.
 *
 * `majorCurves` is the same accumulation restricted to M7+, so each bar can
 * show what share of the year came from the large events. Passing a second
 * curve set costs one extra pass over an 84 KB tier and keeps one accumulator.
 */
export function annualCounts(curves: YearCurves, majorCurves: YearCurves,
                             currentYear: number, today: number,
                             refYears: number[]): AnnualCount[] {
  const peers = refYears
    .map((y) => curves.curves.get(y))
    .filter((c): c is Float64Array => c !== undefined);

  const toDate = peers.map((c) => c[today]).sort((a, b) => a - b);
  const totals = peers.map((c) => c[DAYS - 1]).sort((a, b) => a - b);
  const medianToDate = quantile(toDate, 0.5);
  const medianTotal = quantile(totals, 0.5);

  return curves.years.map((year) => {
    const curve = curves.curves.get(year)!;
    const majorCurve = majorCurves.curves.get(year);
    const at = year === currentYear ? Math.min(today, DAYS - 1) : DAYS - 1;
    const major = majorCurve ? majorCurve[at] : 0;

    if (year !== currentYear) {
      return { year, count: curve[at], major, partial: false, projected: curve[at] };
    }
    const count = curve[at];
    // Scale the reference year-end total by how this year is tracking, rather
    // than extrapolating linearly -- it respects whatever seasonality exists.
    const projected = medianToDate > 0 ? medianTotal * (count / medianToDate) : count;
    return { year, count, major, partial: true, projected: Math.max(count, projected) };
  });
}

/** Type-7 quantile (the R / numpy default) of an ascending array. */
export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export interface BandPoint {
  day: number;
  lo: number;
  loMid: number;
  median: number;
  hiMid: number;
  hi: number;
}

/**
 * Pointwise percentiles of the reference years' cumulative curves.
 *
 * Pointwise, not simultaneous: it answers "is today's count unusual for this
 * date" and is not a confidence region for the whole trajectory.
 */
export function empiricalBand(curves: YearCurves, refYears: number[]): BandPoint[] {
  const series = refYears
    .map((y) => curves.curves.get(y))
    .filter((c): c is Float64Array => c !== undefined);
  if (series.length === 0) return [];

  const out: BandPoint[] = [];
  const scratch = new Array<number>(series.length);
  for (let d = 0; d < DAYS; d++) {
    for (let i = 0; i < series.length; i++) scratch[i] = series[i][d];
    scratch.sort((a, b) => a - b);
    out.push({
      day: d,
      lo: quantile(scratch, 0.05),
      loMid: quantile(scratch, 0.25),
      median: quantile(scratch, 0.5),
      hiMid: quantile(scratch, 0.75),
      hi: quantile(scratch, 0.95),
    });
  }
  return out;
}

export interface Verdict {
  year: number;
  day: number;
  count: number;
  /** Fraction of reference years running below this year at the same date. */
  percentile: number;
  medianToDate: number;
  /** Projected full-year total if the rest of the year matches the reference pace. */
  projected: number;
  refYears: number[];
  inside90: boolean;
}

export function verdict(curves: YearCurves, refYears: number[],
                        currentYear: number, day: number): Verdict | null {
  const current = curves.curves.get(currentYear);
  if (!current) return null;

  const peers = refYears
    .map((y) => curves.curves.get(y))
    .filter((c): c is Float64Array => c !== undefined);
  if (peers.length === 0) return null;

  const count = current[day];
  const toDate = peers.map((c) => c[day]).sort((a, b) => a - b);
  const totals = peers.map((c) => c[DAYS - 1]);

  // Ties count as half, so a year sitting exactly on a peer is not pushed to an
  // extreme; with integer counts and small tiers, exact ties are common.
  let below = 0;
  for (const value of toDate) {
    if (value < count) below += 1;
    else if (value === count) below += 0.5;
  }

  const medianToDate = quantile(toDate, 0.5);
  const medianTotal = quantile([...totals].sort((a, b) => a - b), 0.5);
  const ratio = medianToDate > 0 ? count / medianToDate : 1;

  return {
    year: currentYear,
    day,
    count,
    percentile: below / toDate.length,
    medianToDate,
    projected: medianTotal * ratio,
    refYears,
    inside90: count >= quantile(toDate, 0.05) && count <= quantile(toDate, 0.95),
  };
}
