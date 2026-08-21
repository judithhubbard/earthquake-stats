/**
 * Cumulative-count statistics for the year-over-year chart.
 *
 * Every year is projected onto a common 365-point grid by elapsed fraction of
 * the year, so leap years neither stretch the axis nor create a phantom day 366.
 */

import type { Tier } from "./catalog";
// The trend p-value is the correlation between count and year, which is the
// same test the correlations page runs against temperature and sunspots.
import { correlationP } from "./correlate";

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

/**
 * A straight line through annual counts, with the uncertainty that decides
 * whether it means anything.
 *
 * `perDecade` on its own is not a measurement. On M7+ mainshocks it comes out
 * near +4% while the 95% interval runs from -1% to +9%, so the honest reading
 * is "somewhere in there, including nothing". The interval is what the page
 * shows; the point estimate only ever appears inside it.
 */
export interface Trend {
  perDecade: number;
  /** Half-width of the 95% interval, in the same units. */
  margin: number;
  mean: number;
  /** Year-to-year scatter, for comparing the whole fitted rise against. */
  scatter: number;
  p: number;
  first: number;
  last: number;
  years: number;
}

export function trend(counts: { year: number; value: number }[]): Trend | null {
  const n = counts.length;
  if (n < 5) return null;
  const mx = counts.reduce((a, c) => a + c.year, 0) / n;
  const my = counts.reduce((a, c) => a + c.value, 0) / n;
  const sxx = counts.reduce((a, c) => a + (c.year - mx) ** 2, 0);
  const sxy = counts.reduce((a, c) => a + (c.year - mx) * (c.value - my), 0);
  const slope = sxy / sxx;

  const df = n - 2;
  const rss = counts.reduce((a, c) => a + (c.value - (my + slope * (c.year - mx))) ** 2, 0);
  const scatter = Math.sqrt(rss / df);
  const se = scatter / Math.sqrt(sxx);

  // Two-sided 5% t quantile, same Cornish-Fisher expansion the correlation uses.
  const z = 1.959963984540054;
  const tCrit = z + (z ** 3 + z) / (4 * df)
    + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);

  const first = counts[0].year;
  const last = counts[n - 1].year;
  return {
    perDecade: slope * 10,
    margin: tCrit * se * 10,
    mean: my,
    scatter,
    p: correlationP(sxy / Math.sqrt(sxx * counts.reduce(
      (a, c) => a + (c.value - my) ** 2, 0)), n),
    first, last, years: last - first + 1,
  };
}

/**
 * The chance that the strongest of several trends is this strong, when none of
 * them is real.
 *
 * The obvious formula is Sidak -- 1 - (1 - p)^k for k tests -- but it assumes
 * the tests are independent, and these are not: every M7+ earthquake is also an
 * M6+ earthquake and every mainshock is also an earthquake, so the four yearly
 * count series correlate with each other. Sidak therefore over-states the
 * correction, by roughly the difference between three effective tests and
 * four. The page computes both numbers and prints them side by side.
 *
 * So the joint distribution is measured rather than assumed. The year labels
 * are shuffled -- the SAME shuffle applied to every series at once, which is
 * what keeps the overlap between them intact -- the four slopes are refitted,
 * and the largest t-statistic is recorded. Doing that many times builds the
 * distribution of "strongest of four" under the null that none of them trends,
 * and the answer is how much of it sits at or beyond what the real data
 * produced. This is the Westfall-Young max-T procedure.
 *
 * Two things make it cheap enough to run on page load. Shuffling rows leaves
 * each series' mean and total sum of squares untouched, so a permutation needs
 * only one dot product per series; and the generator is seeded, so the same
 * catalogue always yields the same number rather than a figure that flickers
 * on every refresh.
 *
 * It assumes that with no trend the years would be interchangeable. Aftershock
 * sequences spanning a new year violate that slightly, in the same way and the
 * same direction as they violate the t-test this replaces.
 */
/** Shuffles behind the combined p-value. Named so the page can say how many. */
export const TREND_PERMUTATIONS = 100_000;

export function combinedTrendP(series: { year: number; value: number }[][],
                               permutations = TREND_PERMUTATIONS): number | null {
  const k = series.length;
  if (!k) return null;
  const n = series[0].length;
  if (n < 5 || series.some((s) => s.length !== n)) return null;

  const mx = series[0].reduce((a, c) => a + c.year, 0) / n;
  const x = series[0].map((c) => c.year - mx);
  const sxx = x.reduce((a, v) => a + v * v, 0);

  // Centred values, and the total sum of squares -- both invariant under a row
  // shuffle, which is what reduces a permutation to k dot products.
  const cols = series.map((s) => {
    const my = s.reduce((a, c) => a + c.value, 0) / n;
    return Float64Array.from(s, (c) => c.value - my);
  });
  const syy = cols.map((col) => col.reduce((a, v) => a + v * v, 0));

  const absT = (dot: number, total: number): number => {
    const slope = dot / sxx;
    const rss = total - slope * dot;
    if (!(rss > 0)) return Infinity;
    return Math.abs(slope) / Math.sqrt(rss / (n - 2) / sxx);
  };

  let observed = 0;
  for (let j = 0; j < k; j++) {
    let dot = 0;
    for (let i = 0; i < n; i++) dot += x[i] * cols[j][i];
    observed = Math.max(observed, absT(dot, syy[j]));
  }
  if (!Number.isFinite(observed)) return null;

  // mulberry32, seeded. Deterministic on purpose: the number must depend on the
  // catalogue and nothing else.
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const order = Uint32Array.from({ length: n }, (_, i) => i);
  let atLeast = 0;
  for (let r = 0; r < permutations; r++) {
    for (let i = n - 1; i > 0; i--) {
      const j = (random() * (i + 1)) | 0;
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    let best = 0;
    for (let j = 0; j < k; j++) {
      const col = cols[j];
      let dot = 0;
      for (let i = 0; i < n; i++) dot += x[i] * col[order[i]];
      const t = absT(dot, syy[j]);
      if (t > best) best = t;
    }
    if (best >= observed) atLeast++;
  }
  // Add-one, so the result can never be exactly zero: with 100,000 shuffles the
  // most this can say is "below one in a hundred thousand", and reporting 0
  // would claim more than the method can support.
  return (atLeast + 1) / (permutations + 1);
}

/** Standard normal CDF, via Abramowitz and Stegun 7.1.26 on erf. */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741
            + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Its inverse, by Acklam's rational approximation. Good to about 1e-9. */
export function normalQuantile(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
             3.754408661907416];
  const lo = 0.02425;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
         / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
       / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * A p-value as a percentage, for prose.
 *
 * "under 1" rather than a rounded "0": combinedTrendP deliberately returns
 * (atLeast + 1) / (permutations + 1) so the answer can never be exactly zero,
 * and a display layer that rounds 0.004 to "0" throws that away -- printing
 * "produce a slope at least this steep only 0% of the time" in the very band,
 * p < 1%, where the page reports its strongest finding.
 */
export function asPercent(share: number): string {
  const pct = share * 100;
  return pct < 1 ? "under 1" : pct.toFixed(0);
}

export interface Combined {
  /** Stouffer's combined statistic, corrected for the correlation between tests. */
  z: number;
  /**
   * Share of the previous years that scored higher, as a fraction.
   *
   * Counted, not read off a normal curve. The scores below are what the
   * histogram beside the headline draws, so this is the number a reader can
   * check by counting bars -- and it makes the answer independent of whether
   * the combined score is normally distributed, which 51 years cannot show.
   */
  p: number;
  /** How many previous years scored higher, and how many there were. */
  higher: number;
  peers: number;
  /** How many independent tests the correlated set is worth. */
  effective: number;
  /** The one-sided p-value of each test, in the order given. */
  each: number[];
  /** Number of tests combined. */
  tests: number;
  /**
   * The same combined score for every year, oldest first, this one last. Not
   * needed for the answer, but it is what the answer is a rank within, and a
   * page that prints a rank ought to be able to show the thing ranked.
   */
  scores: number[];
}

/**
 * Stouffer's Z over several tests that are not independent of each other.
 *
 * Every way of counting a year is a test of the same claim -- that this year is
 * no busier than usual -- so the question is how to pool them, not how to
 * correct for having asked several times. Those are different jobs and want
 * different tools. Westfall-Young, used for the trend section, answers "does
 * ANY of these look unusual once you have paid for looking k times", which is
 * the guard against cherry-picking. Stouffer answers "taken together, is the
 * whole set running high", which is the question the front page asks.
 *
 * Plain Stouffer sums the z-scores and divides by sqrt(k), which assumes the
 * tests are independent. These are anything but: M6+ and M7+ moment correlate
 * at 0.99, because moment is dominated by the largest earthquakes either way,
 * and six tests here are worth about 1.7 independent ones. The correction is
 * Strube's -- divide by sqrt of the sum of the whole correlation matrix rather
 * than by sqrt(k) -- with the correlations measured from the past years rather
 * than assumed.
 *
 * `ranks[i]` is test i's percentile for each year, oldest first, with the year
 * being judged last. Percentiles rather than raw values so that tests measured
 * in different units can be pooled at all.
 */
export function combineRanks(ranks: number[][]): Combined | null {
  const k = ranks.length;
  if (!k) return null;
  const n = ranks[0].length;
  if (n < 3 || ranks.some((r) => r.length !== n)) return null;

  // A percentile of 0 or 100 would be an infinite z. Held half a step inside
  // the range the ranking can resolve, which with fifty reference years is one
  // percentile point -- the honest limit of what this many years can say.
  const step = 100 / (2 * (n - 1));
  const z = ranks.map((r) => r.map((v) =>
    normalQuantile(Math.min(100 - step, Math.max(step, v)) / 100)));

  const current = z.map((r) => r[n - 1]);
  const past = z.map((r) => r.slice(0, n - 1));

  // Sum of the correlation matrix, diagonal included: k + 2 * sum of the upper
  // triangle. This is what k correlated tests are worth, and it is what
  // `effective` reports.
  let total = k;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      total += 2 * correlation(past[i], past[j]);
    }
  }
  if (!(total > 0)) return null;

  // The divisor is the variance of the sum, which is the sum of the COVARIANCE
  // matrix. Using the correlation matrix instead assumes each score has
  // variance 1, and these do not: normalQuantile of evenly spaced percentiles
  // gives the two clamped extremes the same weight as every interior point,
  // where a normal would put far less mass that far out. Measured on fifty
  // years the scores carry a variance near 1.05, so dividing by sqrt(total)
  // made every z about 2% too large -- invisible on the chart, because it
  // scales every year alike, but it inflated the p-value it used to be
  // converted into.
  const spread = past.map((column) => {
    const mean = column.reduce((a, v) => a + v, 0) / column.length;
    return column.reduce((a, v) => a + (v - mean) ** 2, 0) / column.length;
  });
  let variance = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      variance += i === j
        ? spread[i]
        : correlation(past[i], past[j]) * Math.sqrt(spread[i] * spread[j]);
    }
  }
  if (!(variance > 0)) return null;

  const root = Math.sqrt(variance);
  const scores: number[] = [];
  for (let j = 0; j < n; j++) {
    let sum = 0;
    for (let i = 0; i < k; i++) sum += z[i][j];
    scores.push(sum / root);
  }
  const combined = scores[n - 1];
  const peerScores = scores.slice(0, n - 1);
  const higher = peerScores.filter((v) => v > combined).length;
  return {
    z: combined,
    scores,
    p: higher / peerScores.length,
    higher,
    peers: peerScores.length,
    effective: (k * k) / total,
    each: current.map((v) => 1 - normalCdf(v)),
    tests: k,
  };
}

function correlation(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((x, v) => x + v, 0) / n;
  const mb = b.reduce((x, v) => x + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? num / den : 0;
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
