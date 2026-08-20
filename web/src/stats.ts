/**
 * Cumulative-count statistics for the year-over-year chart.
 *
 * Every year is projected onto a common 365-point grid by elapsed fraction of
 * the year, so leap years neither stretch the axis nor create a phantom day 366.
 */

import type { Tier } from "./catalog";

export const DAYS = 365;

/**
 * The default threshold, and the one the correlations page always uses.
 *
 * M6+ globally is the level at which ComCat is complete and comparable across
 * decades. Region and reference-period selectors were removed for exactly that
 * reason -- each let a reader wander somewhere the catalogue changes underneath
 * them -- and the magnitude choice is kept narrow for the same reason: M6 and
 * M7 are both solid, and nothing below M6 is offered.
 */
export const MIN_MAGNITUDE = 6;

/** Selectable thresholds. Each needs its own emitted tier; see build.py. */
export const MAGNITUDES = [6, 7];

/** Threshold whose share of each year is drawn as the darker part of a bar. */
export const MAJOR_MAGNITUDE = 7;

/**
 * Elapsed fraction of the year, as an index 0..364. Leap-safe.
 *
 * `shift` slides the whole calendar so that some other date behaves as though
 * it were 1 January. That is how the rolling-year view works: shift by the
 * number of days from 1 January to tomorrow, and "year 2025" becomes the twelve
 * months ending today. Every downstream calculation -- the band, the
 * percentile, the annual bars -- then works unchanged.
 */
export function dayIndex(ms: number, shift = 0): { year: number; day: number } {
  const date = new Date(ms - shift);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const frac = (ms - shift - start) / (end - start);
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

/**
 * Mean and +/-2 standard deviations of the total in a window of d days, taken
 * over every d-day window in the record rather than over the 50 calendar years.
 *
 * The per-calendar-day version has a defect this fixes. Its spread on day d is
 * the spread of the 50 year-to-date totals on that date, so one enormous event
 * enters the calculation abruptly on its own anniversary: Tohoku is 11 March,
 * and the band visibly stepped there and stayed stepped for the rest of the
 * year. That step is an artefact of where the calendar happens to cut, not
 * something about the eleventh of March.
 *
 * Sliding the window over every start date instead spreads that event across
 * every window that contains it, which is what "how much does a year's worth
 * vary" actually means. It also makes the band independent of whether the
 * reader is looking at calendar years or rolling ones.
 *
 * Cost is one pass per window length over a prefix-summed daily series, about
 * six million adds for fifty years, so the result is memoised.
 */
const rollingCache = new Map<string, BandPoint[]>();

export function rollingWindowBand(tier: Tier, minMag: number, mainshocksOnly: boolean,
                                  measure: Measure, minYear: number): BandPoint[] {
  const key = `${tier.info.threshold}|${minMag}|${mainshocksOnly}|${measure}|${minYear}`;
  const hit = rollingCache.get(key);
  if (hit) return hit;

  const start = Date.UTC(minYear, 0, 1);
  const last = tier.info.lastTime ?? start;
  const span = Math.max(1, Math.floor((last - start) / 86_400_000) + 1);
  const daily = new Float64Array(span);

  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] < minMag) continue;
    if (mainshocksOnly && tier.dependent[i]) continue;
    const offset = Math.floor((tier.time[i] - start) / 86_400_000);
    if (offset < 0 || offset >= span) continue;
    daily[offset] += measure === "moment" ? seismicMoment(tier.mag[i]) : 1;
  }

  const prefix = new Float64Array(span + 1);
  for (let i = 0; i < span; i++) prefix[i + 1] = prefix[i] + daily[i];

  const out: BandPoint[] = [];
  for (let d = 0; d < DAYS; d++) {
    const width = d + 1;
    const windows = span - width + 1;
    if (windows < 2) {
      out.push({ day: d, lo: 0, loMid: 0, median: 0, hiMid: 0, hi: 0,
                 mean: 0, sdLo: 0, sdHi: 0 });
      continue;
    }
    let sum = 0, sumSq = 0;
    for (let i = 0; i < windows; i++) {
      const v = prefix[i + width] - prefix[i];
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / windows;
    const variance = Math.max(0, (sumSq - windows * mean * mean) / (windows - 1));
    const sd = Math.sqrt(variance);
    // Only mean and the sigma edges are meaningful here; the percentile fields
    // are left at zero and never read, because the two views never mix.
    out.push({ day: d, lo: 0, loMid: 0, median: 0, hiMid: 0, hi: 0,
               mean, sdLo: Math.max(0, mean - 2 * sd), sdHi: mean + 2 * sd });
  }

  rollingCache.set(key, out);
  return out;
}

export function cumulativeByYear(tier: Tier, minMag: number, minYear: number,
                                 mainshocksOnly = false,
                                 measure: Measure = "count",
                                 shift = 0): YearCurves {
  const daily = new Map<number, Float64Array>();
  let matched = 0;

  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] < minMag) continue;
    if (mainshocksOnly && tier.dependent[i]) continue;
    const { year, day } = dayIndex(tier.time[i], shift);
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
                             refYears: number[],
                             measure: Measure = "count"): AnnualCount[] {
  const q = quantileFor(measure);
  const peers = refYears
    .map((y) => curves.curves.get(y))
    .filter((c): c is Float64Array => c !== undefined);

  const toDate = peers.map((c) => c[today]).sort((a, b) => a - b);
  const totals = peers.map((c) => c[DAYS - 1]).sort((a, b) => a - b);
  const medianToDate = q(toDate, 0.5);
  const medianTotal = q(totals, 0.5);

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

/**
 * Empirical inverse CDF -- quantile type 1.
 *
 * Every value it returns is one that is actually in the array, never a point
 * invented between two of them. That is what counts need: with 49 reference
 * years, type 7 puts the 95th percentile at position 45.6 and reports the M7+
 * band edge as 4.60 earthquakes, which is not a number of earthquakes any year
 * had. The caption promises a band spanning previous years, so the edges should
 * be years. Moment is continuous and keeps type 7, where interpolating between
 * two observations is a meaningful thing to do.
 */
export function quantileDiscrete(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  return sorted[Math.min(n - 1, Math.max(0, Math.ceil(n * p) - 1))];
}

/** Type 7 for moment, type 1 for counts. See `quantileDiscrete`. */
function quantileFor(measure: Measure): (sorted: number[], p: number) => number {
  return measure === "moment" ? quantile : quantileDiscrete;
}

export interface BandPoint {
  day: number;
  lo: number;
  loMid: number;
  median: number;
  hiMid: number;
  hi: number;
  /**
   * The same day described the other way round: mean, and mean +/- 2 standard
   * deviations of the reference years.
   *
   * The percentiles say what previous years did. These say what a normal
   * distribution fitted to them would predict, which is the convention the
   * correlations page uses and is worth being able to compare against -- the
   * two disagree exactly where the distribution is skewed, and cumulative
   * counts are skewed. sdLo is clamped at zero: a count cannot be negative,
   * and early in the year the unclamped figure is.
   */
  mean: number;
  sdLo: number;
  sdHi: number;
}

/**
 * Pointwise percentiles of the reference years' cumulative curves.
 *
 * Pointwise, not simultaneous: it answers "is today's count unusual for this
 * date" and is not a confidence region for the whole trajectory.
 */
export function empiricalBand(curves: YearCurves, refYears: number[],
                              measure: Measure = "count"): BandPoint[] {
  const q = quantileFor(measure);
  const series = refYears
    .map((y) => curves.curves.get(y))
    .filter((c): c is Float64Array => c !== undefined);
  if (series.length === 0) return [];

  const out: BandPoint[] = [];
  const scratch = new Array<number>(series.length);
  for (let d = 0; d < DAYS; d++) {
    for (let i = 0; i < series.length; i++) scratch[i] = series[i][d];
    scratch.sort((a, b) => a - b);
    const n = scratch.length;
    const mean = scratch.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1
      ? Math.sqrt(scratch.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
      : 0;
    out.push({
      day: d,
      lo: q(scratch, 0.05),
      loMid: q(scratch, 0.25),
      median: q(scratch, 0.5),
      hiMid: q(scratch, 0.75),
      hi: q(scratch, 0.95),
      mean,
      sdLo: Math.max(0, mean - 2 * sd),
      sdHi: mean + 2 * sd,
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
  /**
   * Share of reference years that were strictly ahead of this one on this date.
   *
   * Not 1 - percentile: that counts a tied year as half ahead and half behind,
   * which is the right convention for ranking but the wrong answer to "how many
   * years had more". Ties are common here -- integer counts, small tiers -- so
   * the two can differ by several points.
   */
  aboveShare: number;
  /** And the share strictly behind it. Ties belong to neither. */
  belowShare: number;
  medianToDate: number;
  /** Projected full-year total if the rest of the year matches the reference pace. */
  projected: number;
  refYears: number[];
  inside90: boolean;
}

export function verdict(curves: YearCurves, refYears: number[],
                        currentYear: number, day: number,
                        measure: Measure = "count"): Verdict | null {
  const q = quantileFor(measure);
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
  let above = 0;
  let under = 0;
  for (const value of toDate) {
    if (value < count) { below += 1; under += 1; }
    else if (value > count) above += 1;
    else below += 0.5;
  }

  const medianToDate = q(toDate, 0.5);
  const medianTotal = q([...totals].sort((a, b) => a - b), 0.5);
  const ratio = medianToDate > 0 ? count / medianToDate : 1;

  return {
    year: currentYear,
    day,
    count,
    percentile: below / toDate.length,
    aboveShare: above / toDate.length,
    belowShare: under / toDate.length,
    medianToDate,
    projected: medianTotal * ratio,
    refYears,
    inside90: count >= q(toDate, 0.05) && count <= q(toDate, 0.95),
  };
}
