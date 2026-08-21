/**
 * Binning and test statistics for the "do earthquakes correlate with…?" page.
 *
 * Two kinds of question live here and they need different data:
 *
 *   * **Within-year** (day of week, month, moon phase). Every bin is filled
 *     from the same span of years, so the catalogue's changing completeness
 *     hits all of them equally and cancels. That frees the page to use M5+ and
 *     buy real power -- a 1.8% detectable effect against 6.2% at M6+.
 *   * **Year-over-year** (temperature, sunspots). Here completeness does not
 *     cancel, so these use the same fully homogenised M6+ series as the front
 *     page.
 *
 * All of it runs on mainshocks only. Aftershocks arrive in bursts, and a burst
 * lands in whichever bin its mainshock fell in -- which would break the
 * independence the error bands assume and make every null look better than it is.
 */

export interface Bin {
  /** Short form, for the axis. */
  label: string;
  /** Spelled out, for prose. */
  full: string;
  count: number;
  /** Events expected in this bin if nothing is going on. */
  expected: number;
  /** Two-sigma bound on that expectation, from multinomial sampling alone. */
  sigma2: number;
  /** Signed deviation as a percentage of the expectation. */
  deviation: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
                       "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July",
                     "August", "September", "October", "November", "December"];

/**
 * Bins are multinomial given the total, not independently Poisson, so the
 * spread is sqrt(N·p·(1−p)) rather than sqrt(N·p). The difference is small at
 * seven bins and free to get right.
 */
function toBins(counts: number[], labels: string[], weights: number[],
                full: string[] = labels): Bin[] {
  const total = counts.reduce((a, b) => a + b, 0);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return counts.map((count, i) => {
    const p = weights[i] / weightSum;
    const expected = total * p;
    const sigma2 = 2 * Math.sqrt(total * p * (1 - p));
    return {
      label: labels[i],
      full: full[i],
      count,
      expected,
      sigma2,
      deviation: expected > 0 ? (100 * (count - expected)) / expected : 0,
    };
  });
}

export function weekdayBins(times: Float64Array | number[]): Bin[] {
  const counts = new Array(7).fill(0);
  for (const t of times) {
    // getUTCDay is Sunday-first; shift so the week reads Monday-first.
    counts[(new Date(t).getUTCDay() + 6) % 7] += 1;
  }
  return toBins(counts, WEEKDAYS, new Array(7).fill(1), WEEKDAYS_FULL);
}

/**
 * Months differ in length, so raw monthly counts show a February deficit of
 * about 10% that is pure calendar. The expectation is weighted by how many days
 * each month actually contributed across the years in the data.
 */
/**
 * Months are unequal, so the expectation is weighted by how long each one ran.
 *
 * By the days observed, not by whole calendar years. The catalog stops partway
 * through the current year, and crediting that year with all twelve months gave
 * September to December a full month of expectation against data that does not
 * reach them yet. The shortfall read as a real autumn deficit: on times drawn
 * uniformly at random -- no month pattern by construction -- the statistic came
 * out at 15.5 against a df of 11, which is p = 16% where the honest answer is
 * about 42%. Every incomplete year at either end has the same effect.
 *
 * Overlapping each calendar month with the window the events actually cover
 * counts every earthquake and expects exactly the time behind it.
 */
export function monthBins(times: Float64Array | number[]): Bin[] {
  const counts = new Array(12).fill(0);
  const days = new Array(12).fill(0);
  let first = Infinity;
  let last = -Infinity;

  for (const t of times) {
    counts[new Date(t).getUTCMonth()] += 1;
    if (t < first) first = t;
    if (t > last) last = t;
  }
  if (!Number.isFinite(first)) return toBins(counts, MONTHS, new Array(12).fill(1), MONTHS_FULL);

  for (let year = new Date(first).getUTCFullYear();
       year <= new Date(last).getUTCFullYear(); year++) {
    for (let m = 0; m < 12; m++) {
      const from = Math.max(first, Date.UTC(year, m, 1));
      const to = Math.min(last, Date.UTC(year, m + 1, 1));
      if (to > from) days[m] += (to - from) / 86_400_000;
    }
  }
  return toBins(counts, MONTHS, days, MONTHS_FULL);
}

/** Mean synodic month, in days. Quoted on the page, so it is exported. */
export const SYNODIC_DAYS = 29.530588853;
/** 2000-01-06 18:14 UTC, a new moon. */
const NEW_MOON_JD = 2451550.259722;

/**
 * Fraction through the lunar month: 0 is new, 0.5 is full.
 *
 * This is the *mean* synodic phase, which drifts up to about half a day from
 * the true phase. That is the right quantity for the question people actually
 * ask -- they mean the moon they can see on the calendar. The subtler
 * scientific question is tidal stress on a particular fault, which is not this.
 */
export function lunarPhase(ms: number): number {
  const jd = ms / 86_400_000 + 2440587.5;
  const age = (((jd - NEW_MOON_JD) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  return age / SYNODIC_DAYS;
}

/** Days in the lunar cycle, one bin each. Day 1 contains the new moon. */
export const LUNAR_DAYS = 30;
/** Bin index whose midpoint is closest to full moon. */
export const FULL_MOON_DAY = Math.round(LUNAR_DAYS / 2);

/**
 * One bin per day of the lunar cycle.
 *
 * Named phases -- "waxing gibbous" and the rest -- are eight coarse buckets and
 * an extra thing to explain. Days are self-describing, and they let the reader
 * see the shape rather than take a summary on trust: if tides mattered, this
 * chart would show two humps, at new moon and again at full, because that is
 * when sun and moon pull together.
 *
 * The cost is noise. Thirty bins put roughly 1,400 earthquakes in each, so the
 * band is about five times wider than the effect anyone claims. That is worth
 * showing rather than hiding behind coarser bins.
 */
export function lunarBins(times: Float64Array | number[]): Bin[] {
  const counts = new Array(LUNAR_DAYS).fill(0);
  for (const t of times) {
    counts[Math.min(LUNAR_DAYS - 1, Math.floor(lunarPhase(t) * LUNAR_DAYS))] += 1;
  }
  const labels = counts.map((_, i) => String(i + 1));
  const full = counts.map((_, i) => {
    const day = `Day ${i + 1} of the lunar cycle`;
    if (i === 0) return `${day} — new moon`;
    if (i + 1 === FULL_MOON_DAY) return `${day} — full moon`;
    return day;
  });
  return toBins(counts, labels, new Array(LUNAR_DAYS).fill(1), full);
}

/**
 * How many bars leave the band, and how many would anyway.
 *
 * The band is two standard deviations, which holds 95.45% of draws, so 4.55%
 * of bars sit outside it with nothing going on at all. On thirty bars that is
 * one or two — worth saying, or a reader counts two strays and concludes
 * something is happening.
 */
export const OUTSIDE_SHARE = 0.0455;

export function outsideBand(bins: Bin[]): { count: number; expected: number } {
  return {
    count: bins.filter((b) => Math.abs(b.count - b.expected) > b.sigma2).length,
    expected: OUTSIDE_SHARE * bins.length,
  };
}

/** Chi-square across bins, and the 5% critical value for that many bins. */
/** Standard normal upper tail, Abramowitz & Stegun 26.2.17. Six-figure accurate. */
function normalTail(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937
            + t * (-1.821255978 + t * 1.330274429))));
  const tail = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * poly;
  return z >= 0 ? tail : 1 - tail;
}

/**
 * How often random data would produce a chi-square at least this large.
 *
 * Wilson-Hilferty: the cube root of a chi-square over its degrees of freedom is
 * close to normal, and the transform is the same one the critical value uses in
 * the other direction, so the two agree at the 5% point by construction.
 */
export function chiSquareP(statistic: number, df: number): number {
  if (df < 1 || statistic <= 0) return 1;
  const z = (Math.cbrt(statistic / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return normalTail(z);
}

/**
 * The same for a correlation: how often {n} pairs of unrelated numbers would
 * give a correlation at least this strong, in either direction.
 *
 * The t statistic is mapped to a normal deviate rather than integrating the t
 * density; the error is under a thousandth for the degrees of freedom here.
 */
export function correlationP(r: number, n: number): number {
  const df = n - 2;
  if (df < 1) return 1;
  const rr = Math.min(Math.abs(r), 0.999999);
  const t = rr * Math.sqrt(df / (1 - rr * rr));
  const z = t * (1 - 1 / (4 * df)) / Math.sqrt(1 + (t * t) / (2 * df));
  return Math.min(1, 2 * normalTail(z));
}

export function chiSquare(bins: Bin[]): { statistic: number; critical: number; df: number } {
  const statistic = bins.reduce(
    (acc, b) => acc + (b.expected > 0 ? (b.count - b.expected) ** 2 / b.expected : 0), 0);
  const df = bins.length - 1;
  // Wilson-Hilferty: adequate to two decimals over the range of df used here.
  const z = 1.6448536269514722; // one-sided 5%
  const critical = df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
  return { statistic, critical, df };
}

export interface Correlation {
  r: number;
  n: number;
  /** |r| a real relationship would have to exceed at this sample size. */
  critical: number;
  significant: boolean;
}

export function pearson(xs: number[], ys: number[]): Correlation | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;

  const r = sxy / Math.sqrt(sxx * syy);
  const df = n - 2;
  // Cornish-Fisher expansion of the t quantile; within 0.001 of the table for
  // df above about 20, which is every case this page produces.
  const z = 1.959963984540054; // two-sided 5%
  const t = z + (z ** 3 + z) / (4 * df)
    + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);
  const critical = t / Math.sqrt(t * t + df);
  return { r, n, critical, significant: Math.abs(r) > critical };
}


export interface SpringNeap {
  spring: number;
  neap: number;
  /** Percentage excess at spring tides over neap. */
  excess: number;
  z: number;
  significant: boolean;
}

/**
 * The tidal hypothesis, tested the way it should be: one directional comparison
 * motivated by physics, not an omnibus scan across eight bins.
 *
 * Tides are strongest at new and full moon, when sun and moon pull together,
 * and weakest at the quarters. If tides nudge faults at all, the excess belongs
 * in the first group. Testing it this way matters -- an eight-bin chi-square on
 * this data is dominated by whichever bin happens to be low, and gives a
 * different answer at every magnitude, while this comparison gives the same
 * answer (+1.5% at M4.5+, +1.9% at M5+, +1.5% at M6+) at all of them.
 */
export function springNeap(times: Float64Array | number[]): SpringNeap {
  let spring = 0;
  let total = 0;
  for (const t of times) {
    const p = lunarPhase(t);
    // Within a quarter-cycle of new or full.
    if (Math.min(p, 1 - p, Math.abs(p - 0.5)) < 0.125) spring += 1;
    total += 1;
  }
  const neap = total - spring;
  const z = total > 0 ? (spring - total / 2) / Math.sqrt(total / 4) : 0;
  return {
    spring, neap,
    excess: neap > 0 ? (100 * (spring - neap)) / neap : 0,
    z,
    significant: Math.abs(z) >= 2,
  };
}

