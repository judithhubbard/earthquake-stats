/**
 * The cumulative-count chart: highlighted years drawn against every reference
 * year and the range they span.
 *
 * Every highlighted line is direct-labelled with its year, so colour is a
 * convenience for tracing a line, never the thing that identifies it.
 */

import * as Plot from "@observablehq/plot";
import { DAYS, equivalentMagnitude, seismicMoment,
         type AnnualCount, type BandPoint, type YearCurves } from "./stats";

export interface Theme {
  surface: string;
  band: string;
  bandInner: string;
  bandNeutral: string;
  history: string;
  median: string;
  grid: string;
  axis: string;
  text: string;
  muted: string;
  /** Diverging pair: above average, below average. */
  up: string;
  down: string;
  /** Fixed-order accent slots for highlighted years. */
  series: string[];
  /** The cumulative chart's middle-90% and middle-50% fills. */
  rangeOuter: string;
  rangeInner: string;
  rangeInk: string;
  /** Map fills, kept apart from the chart surfaces on purpose. */
  mapOcean: string;
  mapLand: string;
  mapCoast: string;
}

export function readTheme(el: HTMLElement): Theme {
  const style = getComputedStyle(el);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    surface: get("--surface-1"),
    band: get("--band-outer"),
    bandInner: get("--band-inner"),
    bandNeutral: get("--band-neutral"),
    history: get("--history"),
    median: get("--median"),
    grid: get("--grid"),
    axis: get("--axis"),
    text: get("--text-primary"),
    muted: get("--text-muted"),
    up: get("--up"),
    down: get("--down"),
    rangeOuter: get("--range-outer"),
    rangeInner: get("--range-inner"),
    rangeInk: get("--range-ink"),
    mapOcean: get("--map-ocean"),
    mapLand: get("--map-land"),
    mapCoast: get("--map-coast"),
    series: [1, 2, 3, 4, 5].map((i) => get(`--series-${i}`)).filter(Boolean),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Where each month begins along the axis.
 *
 * Day 0 is not necessarily 1 January: the rolling view starts the window on
 * today's date, so the months arrive in a different order and at different
 * offsets. Walking the axis and marking where the month changes gets this right
 * for any window start, which hard-coded January offsets did not.
 */
function monthTicks(dayToDate: (day: number) => Date): number[] {
  const ticks: number[] = [];
  let previous = -1;
  for (let day = 0; day < DAYS; day++) {
    const month = dayToDate(day).getUTCMonth();
    if (month !== previous) {
      ticks.push(day);
      previous = month;
    }
  }
  return ticks;
}

function formatDay(day: number, dayToDate: (day: number) => Date): string {
  const date = dayToDate(day);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * Ticks at round magnitudes, placed at the moment each one stands for.
 *
 * The scale stays linear in moment on purpose. These charts exist to show that
 * one great earthquake outweighs a whole ordinary year -- the note under the
 * cumulative one says the line can jump in a single afternoon -- and a log axis
 * is precisely what would flatten that jump away. So the geometry is left alone
 * and only the labels change.
 *
 * A tenth of a magnitude is a factor of 1.41 in moment, so the ticks spread out
 * up the axis rather than sitting at even intervals. Anything below an eighth of
 * the top is dropped, or they pile onto the baseline.
 */
function magnitudeTicks(max: number): number[] {
  if (!(max > 0)) return [0];
  const ticks: number[] = [];
  for (let m = Math.floor(equivalentMagnitude(max) * 10) / 10; m > 0; m -= 0.1) {
    const moment = seismicMoment(m);
    if (moment < max / 8) break;
    ticks.push(moment);
  }
  // Six labels is as many as the axis holds without them touching.
  const stride = Math.max(1, Math.ceil(ticks.length / 6));
  return [0, ...ticks.filter((_, i) => i % stride === 0)].sort((a, b) => a - b);
}

export interface DistributionOptions {
  peers: { year: number; value: number }[];
  value: number;
  /**
   * Both sides of the split, as big-number-plus-caption. Which one gets drawn
   * depends on where the rule lands: the block sits opposite it, so that when
   * this year runs high the label is not stacked on top of its own marker.
   */
  share: { more: string; moreLabel: string; less: string; lessLabel: string };
  currentLabel: string;
  /** Ticks are magnitudes on the moment view, plain numbers on the count view. */
  tickFormat?: (n: number) => string;
  theme: Theme;
  width: number;
}

/** 1, 2 or 5 times a power of ten -- the bin widths that read as round numbers. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const scaled = raw / power;
  return power * (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10);
}

/**
 * This year against the distribution of every previous year, as a histogram.
 *
 * Bars are the reference years binned by their count on this date. Those past
 * this year's count carry the same red the annual bars use for above average,
 * so the share quoted beside them is something the reader can see rather than
 * take on trust. No y-axis: the question is where the line falls in the pile,
 * not how many years are in any one bar.
 */
export function renderDistribution(opts: DistributionOptions): SVGSVGElement | HTMLElement {
  const { peers, value, theme, width } = opts;
  const values = peers.map((d) => d.value);
  const lo = Math.min(value, ...values);
  const hi = Math.max(value, ...values);
  // Halve the round step, rather than asking niceStep for twice as many bins.
  // It snaps to 1, 2 or 5 times a power of ten, so asking for 26 instead of 13
  // only sometimes moves a rung: counts went 10 to 5, but moment's 586-wide
  // range landed on 50 both times and the figure did not change at all.
  const raw = (niceStep((hi - lo) / 13) || 2) / 2;

  // Counts are integers, and a bin narrower than 1 has gaps it can never fill:
  // at M7+ the range is 2 to 13, which halved to bins of 0.5 and drew every
  // other one empty. Whole steps, and edges on the halves so each bin is
  // centred on the count it holds rather than straddling two of them.
  const integral = Number.isInteger(value) && values.every(Number.isInteger);
  const step = integral ? Math.max(1, Math.round(raw)) : raw;
  const start = integral
    ? Math.floor(lo / step) * step - 0.5
    : Math.floor(lo / step) * step;
  const count = Math.max(1, Math.ceil((hi - start) / step) + 1);

  const bins = Array.from({ length: count }, (_, i) => ({
    x0: start + i * step, x1: start + (i + 1) * step, n: 0,
  }));
  for (const v of values) {
    bins[Math.min(bins.length - 1, Math.floor((v - start) / step))].n += 1;
  }
  const tallest = Math.max(1, ...bins.map((b) => b.n));
  // Where the rule falls across the frame, 0 to 1, so labels near an edge can be
  // anchored inward instead of centred on a position with no room either side.
  const domainHi = bins[bins.length - 1].x1;
  const place = domainHi > start ? (value - start) / (domainHi - start) : 0.5;
  // The share block goes on the side the rule is not on. Flipping at the
  // midpoint rather than later is what keeps it clear of the year label: both
  // sit in the same band above the bars, so the only thing separating them is
  // horizontal distance, and past halfway the red side is too thin to label.
  const flip = place > 0.5;

  // Which side of the line each bar belongs to.
  //
  // On integer bins the answer is exact: each one holds a single count, so a bar
  // is "more" when its count is above this year's, and the bin sitting on the
  // value holds the years that tied -- they did not have more, so it stays on
  // the sage side and the red area is exactly the years the share counts.
  //
  // On a continuous scale no such bin exists, so the one holding the value is
  // cut at the line and each half takes its own side's colour. Cutting the
  // integer case too would leave a half-bin slice narrower than the gap between
  // bars, which renders as nothing at all.
  const rects: { x0: number; x1: number; n: number; above: boolean }[] = [];
  for (const bin of bins) {
    if (!integral && value > bin.x0 && value < bin.x1) {
      rects.push({ x0: bin.x0, x1: value, n: bin.n, above: false });
      rects.push({ x0: value, x1: bin.x1, n: bin.n, above: true });
    } else {
      rects.push({ ...bin, above: (bin.x0 + bin.x1) / 2 > value });
    }
  }

  return Plot.plot({
    width,
    height: 150,
    // Side margins hold a tick label; the first and last ticks sit on the frame
    // edge, so 8px cut them in half. The caption lives outside the figure, in
    // HTML that can wrap -- inside the plot it was one line and ran off the end.
    marginTop: 30, marginBottom: 42, marginLeft: 24, marginRight: 24,
    style: { background: "transparent", color: theme.text, fontSize: "11px" },
    x: {
      label: null, ticks: 4, tickSize: 0, tickPadding: 7,
      ...(opts.tickFormat ? { tickFormat: opts.tickFormat } : {}),
    },
    y: { axis: null, domain: [0, tallest * 1.35] },
    color: { type: "identity" },
    marks: [
      Plot.rectY(rects, {
        x1: "x0", x2: "x1", y: "n",
        fill: (d: { above: boolean }) => (d.above ? theme.up : theme.rangeInner),
        fillOpacity: (d: { above: boolean }) => (d.above ? 0.55 : 1),
        insetLeft: 0.75, insetRight: 0.75,
      }),
      Plot.ruleY([0], { stroke: theme.axis }),
      Plot.ruleX([value], { stroke: theme.series[0], strokeWidth: 2.5 }),
      // Above the bars, at the rule. Inside the frame rather than in the top
      // margin, which is where the share block lives -- that vertical gap is
      // what keeps the two from ever colliding, whatever the rule's position.
      // The rule runs the full height of the frame, so it passes straight
      // through this label. Plot draws a stroked text mark with paint-order:
      // stroke, which puts the halo behind the glyphs and knocks the rule out
      // from under them.
      Plot.text([{ x: value, y: tallest * 1.16 }], {
        x: "x", y: "y", text: () => opts.currentLabel,
        textAnchor: place < 0.14 ? "start" : place > 0.86 ? "end" : "middle",
        fill: theme.series[0], stroke: theme.surface, strokeWidth: 4,
        fontWeight: 650, fontSize: 12.5,
      }),
      Plot.text([{}], {
        text: () => (flip ? opts.share.less : opts.share.more),
        frameAnchor: flip ? "top-left" : "top-right",
        dy: 4, dx: flip ? 2 : -2,
        fill: flip ? theme.rangeInk : theme.up, fontWeight: 700, fontSize: 25,
      }),
      Plot.text([{}], {
        text: () => (flip ? opts.share.lessLabel : opts.share.moreLabel),
        frameAnchor: flip ? "top-left" : "top-right",
        dy: 26, dx: flip ? 2 : -2,
        fill: theme.muted, fontSize: 10.5,
      }),
    ],
  });
}

export interface Highlight {
  year: number;
  /** What to print at the end of the line: "2026", or "2025–26" when rolling. */
  label: string;
  color: string;
  /** Last day index to draw; the current year stops at today. */
  through: number;
}

export interface ChartOptions {
  curves: YearCurves;
  band: BandPoint[];
  refYears: number[];
  highlights: Highlight[];
  today: number;
  theme: Theme;
  width: number;
  yLabel: string;
  /** Suppress half-step tick labels; counts have no halves. */
  wholeNumbers?: boolean;
  /** Top of the y range, so the moment ticks can be placed on round magnitudes. */
  yMax?: number;
  /** Real date for a day index, which the rolling window shifts. */
  dayToDate: (day: number) => Date;
}

interface EndPoint { day: number; value: number; label: string; color: string; }

export function renderChart(opts: ChartOptions): SVGSVGElement | HTMLElement {
  const { curves, band, refYears, highlights, today, theme, width, dayToDate } = opts;

  const highlighted = new Set(highlights.map((h) => h.year));
  const history: { day: number; value: number; year: number }[] = [];
  for (const year of curves.years) {
    if (highlighted.has(year) || !refYears.includes(year)) continue;
    const curve = curves.curves.get(year)!;
    for (let d = 0; d < DAYS; d++) history.push({ day: d, value: curve[d], year });
  }

  const lines: { day: number; value: number; year: number }[] = [];
  const ends: EndPoint[] = [];
  for (const h of highlights) {
    const curve = curves.curves.get(h.year);
    if (!curve) continue;
    const last = Math.min(h.through, DAYS - 1);
    for (let d = 0; d <= last; d++) lines.push({ day: d, value: curve[d], year: h.year });
    ends.push({ day: last, value: curve[last], label: h.label, color: h.color });
  }

  const colorFor = new Map(highlights.map((h) => [h.year, h.color]));

  // The end-of-line label sits in the right margin. In the rolling view the
  // line reaches the last day, so the label starts hard against the plot edge --
  // a margin fitted to "2026" clipped "2025-26". Size it to the labels instead.
  const longestLabel = Math.max(4, ...highlights.map((h) => h.label.length));
  const marginRight = Math.ceil(longestLabel * 7.6) + 22;

  // Tooltip rows carry every highlighted year at once, so one crosshair explains
  // the whole chart rather than whichever line the pointer happens to be near.
  const primary = highlights[0];
  const hover = band.slice(0, Math.min(today + 1, DAYS)).map((b) => {
    const row: Record<string, number> = { day: b.day, median: b.median, lo: b.lo, hi: b.hi };
    for (const h of highlights) {
      const curve = curves.curves.get(h.year);
      row[`y${h.year}`] = curve && b.day <= h.through ? curve[b.day] : NaN;
    }
    // With every year deselected the tip rides the reference median rather than
    // collapsing onto the axis.
    const lead = primary ? row[`y${primary.year}`] : NaN;
    row.value = Number.isFinite(lead) ? lead : b.median;
    return row;
  });

  const marks: Plot.Markish[] = [
    // Outer band first, inner on top: the middle half sits inside the middle 90%.
    Plot.areaY(band, { x: "day", y1: "lo", y2: "hi",
                      fill: theme.rangeOuter, stroke: null, curve: "step-after" }),
    Plot.areaY(band, { x: "day", y1: "loMid", y2: "hiMid",
                      fill: theme.rangeInner, stroke: null, curve: "step-after" }),
    Plot.line(history, {
      x: "day", y: "value", z: "year", curve: "step-after",
      stroke: theme.history, strokeWidth: 1, strokeOpacity: 0.32,
    }),
    Plot.line(band, {
      x: "day", y: "median", curve: "step-after",
      stroke: theme.median, strokeWidth: 2.25,
    }),
    // A surface-coloured casing keeps each accent legible where it crosses the
    // spaghetti and where two highlighted years cross each other.
    Plot.line(lines, {
      x: "day", y: "value", z: "year", curve: "step-after",
      stroke: theme.surface, strokeWidth: 5.5, strokeLinecap: "round",
    }),
    Plot.line(lines, {
      x: "day", y: "value", z: "year", curve: "step-after",
      stroke: (d: { year: number }) => colorFor.get(d.year) ?? theme.history,
      strokeWidth: 2.5, strokeLinecap: "round",
    }),
    Plot.dot(ends, {
      x: "day", y: "value",
      fill: "color", stroke: theme.surface, strokeWidth: 2, r: 4.5,
    }),
    Plot.text(ends, {
      x: "day", y: "value",
      text: (d: EndPoint) => d.label,
      dx: 9, dy: -9, textAnchor: "start",
      fill: theme.text, fontWeight: 650, fontSize: 12.5,
    }),
  ];

  // No per-line tip here. It was meant to name whichever faint reference year
  // the pointer was nearest, and a tight maxRadius was supposed to keep it
  // quiet -- but it uses Plot.pointer while the summary below uses pointerX, so
  // anywhere near a line both fired and drew two boxes on top of each other.
  // The crosshair already gives the date, every highlighted year, the median
  // and the range, which is what the chart is for.

  if (hover.length > 0) {
    marks.push(
      Plot.ruleX(hover, Plot.pointerX({
        x: "day", stroke: theme.muted, strokeWidth: 1, strokeDasharray: "3,3",
      })),
      Plot.tip(hover, Plot.pointerX({
        x: "day", y: "value",
        fill: theme.surface, stroke: theme.axis, textPadding: 12, fontSize: 16,
        title: (d: Record<string, number>) => {
          const rows = [formatDay(d.day, dayToDate)];
          for (const h of highlights) {
            const value = d[`y${h.year}`];
            if (Number.isFinite(value)) rows.push(`${h.year}:  ${value.toLocaleString()}`);
          }
          rows.push(`Reference median:  ${Math.round(d.median).toLocaleString()}`);
          rows.push(`Middle 90%:  ${Math.round(d.lo).toLocaleString()}–${Math.round(d.hi).toLocaleString()}`);
          return rows.join("\n");
        },
      })),
    );
  }

  return Plot.plot({
    width,
    height: Math.max(320, Math.min(460, width * 0.5)),
    marginLeft: 70,
    marginRight,
    marginBottom: 34,
    marginTop: 16,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    x: {
      domain: [0, DAYS - 1],
      ticks: monthTicks(dayToDate),
      tickFormat: (d: number) => MONTHS[dayToDate(d).getUTCMonth()],
      label: null,
      tickSize: 0,
      tickPadding: 10,
    },
    y: {
      label: opts.yLabel,
      // Rotated and centred against the axis rather than Plot's default
      // top-anchored label, which sits on top of the tick numbers.
      labelAnchor: "center",
      labelOffset: 52,
      // Counts get whole numbers; moment gets the magnitude it is equivalent to.
      ticks: opts.wholeNumbers ? undefined : magnitudeTicks(opts.yMax ?? 0),
      tickFormat: opts.wholeNumbers
        ? (d: number) => (Number.isInteger(d) ? d.toLocaleString() : "")
        : (d: number) => (d > 0 ? `M${equivalentMagnitude(d).toFixed(1)}` : "0"),

      grid: true,
      nice: true,
      zero: true,
    },
    color: { type: "identity" },
    marks,
  });
}

export interface AnnualOptions {
  counts: AnnualCount[];
  highlights: Highlight[];
  refYears: number[];
  theme: Theme;
  width: number;
  yLabel: string;
  wholeNumbers?: boolean;
  /** Top of the y range, so the moment ticks can be placed on round magnitudes. */
  yMax?: number;
}

/**
 * Per-year totals. This is where a long-run trend becomes something the reader
 * can check by eye, which is why the trend claim lives beside this chart rather
 * than in the headline.
 */
export function renderAnnualChart(opts: AnnualOptions): SVGSVGElement | HTMLElement {
  const { counts, highlights, refYears, theme, width } = opts;

  const colorFor = new Map(highlights.map((h) => [h.year, h.color]));
  const refSet = new Set(refYears);
  const mean = refYears.length
    ? counts.filter((c) => refSet.has(c.year)).reduce((a, c) => a + c.count, 0) / refYears.length
    : 0;

  const fill = (d: AnnualCount) => colorFor.get(d.year) ?? theme.history;
  // The unfinished part of the current year is drawn as a hollow extension, so
  // the solid bar is always a count that actually happened.
  const partial = counts.filter((c) => c.partial && c.projected > c.count);
  const withMajor = counts.filter((c) => c.major > 0);

  // Each bar is one hue at two strengths -- the M7+ share is the darker part
  // sitting on the baseline, so composition reads without spending a second
  // colour that would collide with the highlighted years.
  const marks: Plot.Markish[] = [
    Plot.rectY(counts, {
      x: "year", y1: "major", y2: "count",
      fill, fillOpacity: (d: AnnualCount) => (colorFor.has(d.year) ? 0.45 : 0.3),
      insetLeft: 0.5, insetRight: 0.5,
    }),
    Plot.rectY(withMajor, {
      x: "year", y: "major",
      fill, fillOpacity: (d: AnnualCount) => (colorFor.has(d.year) ? 1 : 0.75),
      insetLeft: 0.5, insetRight: 0.5,
    }),
    Plot.rectY(partial, {
      x: "year", y1: "count", y2: "projected",
      fill: "none", stroke: fill, strokeWidth: 1, strokeDasharray: "2,2",
      insetLeft: 0.5, insetRight: 0.5,
    }),
  ];

  if (mean > 0) {
    marks.push(
      Plot.ruleY([mean], { stroke: theme.muted, strokeWidth: 1.5, strokeDasharray: "4,3" }),
      Plot.text([mean], {
        x: () => counts[0]?.year ?? 0, y: (d: number) => d,
        text: () => `mean ${Math.round(mean).toLocaleString()}`,
        dy: -7, dx: 2, textAnchor: "start", fill: theme.muted, fontSize: 11,
      }),
    );
  }

  marks.push(
    Plot.ruleY([0], { stroke: theme.axis, strokeWidth: 1 }),
    Plot.tip(counts, Plot.pointerX({
      x: "year", y: "count",
      fill: theme.surface, stroke: theme.axis, textPadding: 12, fontSize: 16,
      title: (d: AnnualCount) => {
        const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString()
          : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
        const rows = d.partial
          ? [`${d.year} (in progress)`, `So far:  ${fmt(d.count)}`,
             `On this pace:  ${fmt(Math.round(d.projected))}`]
          : [`${d.year}:  ${fmt(d.count)}`];
        if (d.major > 0) rows.push(`of which M7+:  ${fmt(d.major)}`);
        return rows.join("\n");
      },
    })),
  );

  return Plot.plot({
    width,
    height: Math.max(200, Math.min(280, width * 0.3)),
    marginLeft: 70,
    marginRight: 62,
    marginBottom: 30,
    marginTop: 20,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    x: { label: null, tickSize: 0, tickPadding: 8, interval: 1, ticks: 8, tickFormat: "d" },
    y: {
      label: opts.yLabel,
      labelAnchor: "center",
      labelOffset: 52,
      // Counts get whole numbers; moment gets the magnitude it is equivalent to.
      ticks: opts.wholeNumbers ? undefined : magnitudeTicks(opts.yMax ?? 0),
      tickFormat: opts.wholeNumbers
        ? (d: number) => (Number.isInteger(d) ? d.toLocaleString() : "")
        : (d: number) => (d > 0 ? `M${equivalentMagnitude(d).toFixed(1)}` : "0"),
      grid: true,
      nice: true,
      zero: true,
    },
    color: { type: "identity" },
    marks,
  });
}
