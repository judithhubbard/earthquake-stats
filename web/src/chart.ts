/**
 * The cumulative-count chart: highlighted years drawn against every reference
 * year and the range they span.
 *
 * Every highlighted line is direct-labelled with its year, so colour is a
 * convenience for tracing a line, never the thing that identifies it.
 */

import * as Plot from "@observablehq/plot";
import { DAYS, type AnnualCount, type BandPoint, type YearCurves } from "./stats";

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
    Plot.areaY(band, { x: "day", y1: "lo", y2: "hi", fill: theme.band, stroke: null }),
    Plot.areaY(band, { x: "day", y1: "loMid", y2: "hiMid", fill: theme.bandInner, stroke: null }),
    Plot.line(history, {
      x: "day", y: "value", z: "year",
      stroke: theme.history, strokeWidth: 1, strokeOpacity: 0.32,
    }),
    Plot.line(band, {
      x: "day", y: "median",
      stroke: theme.median, strokeWidth: 1.5, strokeDasharray: "4,3",
    }),
    // A surface-coloured casing keeps each accent legible where it crosses the
    // spaghetti and where two highlighted years cross each other.
    Plot.line(lines, {
      x: "day", y: "value", z: "year",
      stroke: theme.surface, strokeWidth: 5.5, strokeLinecap: "round",
    }),
    Plot.line(lines, {
      x: "day", y: "value", z: "year",
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

  // Names whichever line the pointer is actually near, so the faint reference
  // years are identifiable. A tight maxRadius keeps it quiet unless the pointer
  // is genuinely on a line, which stops it fighting the crosshair summary.
  marks.push(
    Plot.tip(history, Plot.pointer({
      x: "day", y: "value", maxRadius: 14,
      fill: theme.surface, stroke: theme.axis, textPadding: 7, fontSize: 11,
      anchor: "bottom",
      title: (d: { year: number; value: number; day: number }) =>
        `${d.year}\n${d.value.toLocaleString()} by ${formatDay(d.day, dayToDate)}`,
    })),
  );

  if (hover.length > 0) {
    marks.push(
      Plot.ruleX(hover, Plot.pointerX({
        x: "day", stroke: theme.muted, strokeWidth: 1, strokeDasharray: "3,3",
      })),
      Plot.tip(hover, Plot.pointerX({
        x: "day", y: "value",
        fill: theme.surface, stroke: theme.axis, textPadding: 10,
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
      tickFormat: opts.wholeNumbers
        ? (d: number) => (Number.isInteger(d) ? d.toLocaleString() : "")
        : undefined,

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
      Plot.ruleY([mean], { stroke: theme.median, strokeWidth: 1.5, strokeDasharray: "4,3" }),
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
      fill: theme.surface, stroke: theme.axis, textPadding: 10,
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
      tickFormat: opts.wholeNumbers
        ? (d: number) => (Number.isInteger(d) ? d.toLocaleString() : "")
        : undefined,
      grid: true,
      nice: true,
      zero: true,
    },
    color: { type: "identity" },
    marks,
  });
}
