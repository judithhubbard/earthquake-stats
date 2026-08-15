import * as Plot from "@observablehq/plot";
import { CatalogStore, DATA_BASE, loadMeta, type Meta, type Tier } from "./catalog";
import { readTheme, type Theme } from "./chart";
import { MIN_MAGNITUDE, dayIndex } from "./stats";
import { copy, fill } from "./copy";
import {
  FULL_MOON_DAY, chiSquare, lunarBins, monthBins, outsideBand, pearson, weekdayBins,
  type Bin, type Correlation,
} from "./correlate";

/** Within-year bins use M5+: completeness cancels, and the power is four times better. */
const BIN_MAGNITUDE = 5;
const FIRST_YEAR = 1976;
const TIDES_ARTICLE =
  "https://earthquakeinsights.substack.com/p/the-great-tidal-earthquake-hypothesis-bf7";
/** Oklahoma's injection-driven swarm begins in 2009; before that is background. */
const OKLAHOMA_BACKGROUND_END = 2008;

interface Series { label: string; unit: string; source: string; url: string;
                   years: Record<string, number>; }
interface Context { generated: string; temperature?: Series; sunspots?: Series;
                    oklahoma?: Series; }

const el = {
  answer: document.getElementById("answer")!,
  answerDetail: document.getElementById("answer-detail")!,
  guide: document.getElementById("guide")!,
  panels: document.getElementById("panels")!,
  method: document.getElementById("method")!,
  sources: document.getElementById("sources")!,
};

let theme: Theme;
let redraw: (() => void)[] = [];

/* ---------------- panel scaffolding ---------------- */

/** A swatch has to look like the mark it stands for, or it misdescribes it. */
interface LegendKey { color: string; label: string; band?: boolean; dashed?: boolean; }

/**
 * The verdict must be answerable from the chart directly beneath it. Anything
 * that rests on evidence the chart does not show belongs in the explanation.
 */
function panel(question: string, verdict: string, note: string,
               draw: (width: number) => SVGSVGElement | HTMLElement,
               reading?: { label: string; url: string },
               subtitle?: string, legend?: LegendKey[]): HTMLElement {
  const section = document.createElement("figure");
  section.className = "chart correlate-panel";

  const heading = document.createElement("figcaption");
  heading.className = "correlate-question";
  heading.textContent = question;

  const answer = document.createElement("p");
  answer.className = "correlate-verdict";
  answer.textContent = verdict;

  const caption = document.createElement("p");
  caption.className = "correlate-explain";
  caption.textContent = note;

  section.append(heading, answer, caption);

  if (subtitle) {
    const sub = document.createElement("p");
    sub.className = "correlate-subtitle";
    sub.textContent = subtitle;
    section.append(sub);
  }

  const host = document.createElement("div");
  host.className = "correlate-chart";
  section.append(host);

  if (legend) {
    const box = document.createElement("p");
    box.className = "legend";
    for (const key of legend) {
      const entry = document.createElement("span");
      const swatch = document.createElement("i");
      if (key.band) {
        swatch.className = "swatch-band";
        swatch.style.background = key.color;
      } else if (key.dashed) {
        swatch.className = "swatch-dashed";
        swatch.style.backgroundImage =
          `repeating-linear-gradient(to right, ${key.color} 0 4px, transparent 4px 7px)`;
      } else {
        swatch.style.background = key.color;
      }
      entry.append(swatch, document.createTextNode(key.label));
      box.append(entry);
    }
    section.append(box);
  }
  if (reading) {
    const link = document.createElement("a");
    link.className = "correlate-more";
    link.href = reading.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${reading.label} →`;
    section.append(link);
  }
  redraw.push(() => {
    const width = Math.max(320, host.clientWidth || 760);
    host.replaceChildren(draw(width));
  });
  return section;
}

/**
 * Deviation from average, not raw counts.
 *
 * Plotting the counts was unreadable: every bar stood ~5,000 tall and the whole
 * question lived in the top 3%, so the error band was a hairline near the top
 * and the bars looked identical. Centring on zero puts the answer where the eye
 * already is -- a bar that leaves the grey is interesting, one that does not is
 * not.
 *
 * Individual bars are never highlighted. With seven or twelve bins, one poking
 * out of a 2-sigma band is ordinary; colouring it would imply a finding the
 * whole-chart test does not support.
 */
function binChart(bins: Bin[], width: number,
                  opts: { ticks?: string[]; markers?: { at: string; label: string }[] } = {},
                  ): SVGSVGElement | HTMLElement {
  const band = 2 * Math.max(...bins.map((b) => (100 * b.sigma2) / b.expected)) * 0.5;
  const limit = Math.max(band * 1.6, ...bins.map((b) => Math.abs(b.deviation) * 1.3));

  return Plot.plot({
    width,
    height: Math.max(200, Math.min(260, width * 0.3)),
    marginLeft: 68,
    marginRight: 14,
    marginBottom: 38,
    marginTop: 12,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    // An explicit domain: a band scale otherwise sorts itself alphabetically,
    // which puts Friday before Monday and April before January.
    x: {
      domain: bins.map((b) => b.label),
      // With thirty bins every label will not fit; the caller names the few
      // that carry meaning.
      ...(opts.ticks ? { ticks: opts.ticks } : {}),
      label: null, tickSize: 0, tickPadding: 8,
    },
    y: {
      domain: [-limit, limit],
      label: "Difference from average",
      labelAnchor: "center",
      labelOffset: 52,
      // No arrow: this axis runs both ways from zero, so pointing it one way
      // would say that only the upward half counts as a difference.
      labelArrow: null,
      tickFormat: (d: number) => `${d > 0 ? "+" : ""}${d.toFixed(0)}%`,
    },
    color: { type: "identity" },
    marks: [
      Plot.rectY(bins, {
        x: "label",
        y1: (d: Bin) => (-100 * d.sigma2) / d.expected,
        y2: (d: Bin) => (100 * d.sigma2) / d.expected,
        fill: theme.bandNeutral, insetLeft: -0.5, insetRight: -0.5,
      }),
      // After the band, so the scale stays readable across it.
      Plot.gridY({ stroke: theme.grid, strokeOpacity: 1 }),
      Plot.rectY(bins, {
        x: "label", y: "deviation",
        // Two poles of a diverging pair: at a glance a short bar up and a short
        // bar down are otherwise the same shape.
        fill: (d: Bin) => (d.deviation >= 0 ? theme.up : theme.down),
        fillOpacity: 0.9, insetLeft: 7, insetRight: 7,
      }),
      Plot.ruleY([0], { stroke: theme.axis, strokeWidth: 1.2 }),
      // A labelled rule, not a floating word: the whole question on the moon
      // chart is whether anything happens *at* new and full moon, so those two
      // days have to be findable at a glance.
      ...(opts.markers ?? []).flatMap((m) => [
        Plot.ruleX([m], {
          x: "at", stroke: theme.text, strokeOpacity: 0.35,
          strokeWidth: 1, strokeDasharray: "3,3",
        }),
        Plot.text([m], {
          x: "at", frameAnchor: "top", text: "label",
          dy: 1, fill: theme.text, fontSize: 11, fontWeight: 600,
        }),
      ]),
      Plot.tip(bins, Plot.pointerX({
        x: "label", y: "deviation",
        fill: theme.surface, stroke: theme.axis, textPadding: 9, fontSize: 11,
        title: (d: Bin) =>
          `${d.full}\n${Math.round(d.count).toLocaleString()} earthquakes\n` +
          `${d.deviation >= 0 ? "+" : "−"}${Math.abs(d.deviation).toFixed(1)}% vs average`,
      })),
    ],
  });
}

function scatterChart(points: { x: number; y: number; year: number }[], width: number,
                      xLabel: string, yLabel: string): SVGSVGElement | HTMLElement {
  return Plot.plot({
    width,
    height: Math.max(210, Math.min(300, width * 0.36)),
    marginLeft: 68,
    marginBottom: 42,
    marginTop: 12,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    x: { label: xLabel, labelAnchor: "center", grid: true, nice: true },
    y: { label: yLabel, labelAnchor: "center", labelOffset: 52, grid: true, nice: true },
    color: { type: "identity" },
    marks: [
      Plot.dot(points, {
        x: "x", y: "y", r: 3.6,
        fill: theme.series[0], fillOpacity: 0.75,
        stroke: theme.surface, strokeWidth: 0.6,
      }),
      Plot.tip(points, Plot.pointer({
        x: "x", y: "y", maxRadius: 22,
        fill: theme.surface, stroke: theme.axis, textPadding: 9, fontSize: 11,
        title: (d: { year: number; x: number; y: number }) =>
          `${d.year}\n${d.y.toLocaleString()} earthquakes\n${xLabel}: ${d.x}`,
      })),
    ],
  });
}

/* ---------------- verdicts ---------------- */

function binVerdict(bins: Bin[]): { verdict: string; note: string } {
  const C = copy.correlations;
  const test = chiSquare(bins);
  const worst = bins.reduce((a, b) =>
    Math.abs(b.deviation) > Math.abs(a.deviation) ? b : a);
  const stray = outsideBand(bins);

  const shared = { bin: worst.full, percent: Math.abs(worst.deviation).toFixed(1),
                   bins: bins.length };
  const tally = stray.count === 0
    ? fill(C.biggestAllInside, shared)
    : fill(C.biggestSomeOutside, {
        ...shared,
        n: stray.count,
        verb: stray.count === 1 ? "falls" : "fall",
        expected: stray.expected < 0.5
          ? C.outsideFewer
          : fill(C.outsideAbout, { n: stray.expected.toFixed(1) }),
      });

  return test.statistic <= test.critical
    ? { verdict: C.verdictNo, note: `${tally} ${C.withinNormal}` }
    : { verdict: C.verdictNotReally,
        note: `${tally} ${fill(C.outsideGrey, {
          chi: test.statistic.toFixed(1), df: test.df,
          critical: test.critical.toFixed(1),
        })}` };
}

function scatterVerdict(c: Correlation | null, driver: string): { verdict: string; note: string } {
  if (!c) return { verdict: "Not enough data.", note: "" };
  const strength = fill(copy.correlations.scatterStrength,
    { years: c.n, r: c.r.toFixed(2), critical: c.critical.toFixed(2) });
  return c.significant
    ? { verdict: copy.correlations.verdictMaybe, note: `${strength} ${copy.correlations.scatterHint}` }
    : { verdict: copy.correlations.verdictNo,
        note: `${strength} ${fill(copy.correlations.scatterNull, { driver })}` };
}

/* ---------------- build ---------------- */

function seriesPoints(series: Series, counts: Map<number, number>) {
  const points: { x: number; y: number; year: number }[] = [];
  for (const [year, count] of counts) {
    const value = series.years[String(year)];
    if (value === undefined) continue;
    points.push({ x: value, y: count, year });
  }
  return points.sort((a, b) => a.year - b.year);
}

function annualCounts(tier: Tier, minMag: number, firstYear: number,
                      lastYear: number): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] < minMag || tier.dependent[i]) continue;
    const { year } = dayIndex(tier.time[i]);
    if (year < firstYear || year > lastYear) continue;
    out.set(year, (out.get(year) ?? 0) + 1);
  }
  return out;
}

/** Mainshock times at or above `minMag`, from `firstYear` onward. */
function mainshockTimes(tier: Tier, minMag: number, firstYear: number): number[] {
  const times: number[] = [];
  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] < minMag || tier.dependent[i]) continue;
    if (dayIndex(tier.time[i]).year < firstYear) continue;
    times.push(tier.time[i]);
  }
  return times;
}

async function boot() {
  let meta: Meta;
  let context: Context;
  try {
    const [m, res] = await Promise.all([loadMeta(), fetch(`${DATA_BASE}/context.json`)]);
    meta = m;
    context = res.ok ? await res.json() : {};
  } catch (err) {
    el.answer.textContent = copy.correlations.errorLoad;
    el.answerDetail.textContent = (err as Error).message;
    return;
  }

  const store = new CatalogStore(meta);
  const [fine, coarse] = await Promise.all([
    store.load(BIN_MAGNITUDE), store.load(MIN_MAGNITUDE),
  ]);

  theme = readTheme(document.body);
  const times = mainshockTimes(fine, BIN_MAGNITUDE, FIRST_YEAR);
  const lastComplete = dayIndex(Date.now()).year - 1;
  const yearly = annualCounts(coarse, MIN_MAGNITUDE, FIRST_YEAR, lastComplete);

  el.answer.innerHTML = copy.correlations.answer;
  el.answerDetail.textContent = fill(copy.correlations.detail,
    { count: times.length.toLocaleString(), from: FIRST_YEAR });

  el.guide.innerHTML = copy.correlations.guide;

  const legend: LegendKey[] = [
    { color: theme.bandNeutral, label: copy.correlations.legendBand, band: true },
    { color: theme.up, label: copy.correlations.legendAbove },
    { color: theme.down, label: copy.correlations.legendBelow },
  ];
  const since = fill(copy.correlations.subtitleSince,
    { threshold: BIN_MAGNITUDE, from: FIRST_YEAR });

  const built: HTMLElement[] = [];

  built.push(panel(copy.correlations.weekdayQuestion,
    binVerdict(weekdayBins(times)).verdict,
    `${binVerdict(weekdayBins(times)).note} ${copy.correlations.weekdayExplain}`.trim(),
    (w) => binChart(weekdayBins(times), w), undefined,
    fill(copy.correlations.weekdaySubtitle, { since }), legend));

  built.push(panel(copy.correlations.monthQuestion,
    binVerdict(monthBins(times)).verdict,
    `${binVerdict(monthBins(times)).note} ${copy.correlations.monthExplain}`,
    (w) => binChart(monthBins(times), w), undefined,
    fill(copy.correlations.monthSubtitle, { since }), legend));

  // We do not claim the small spring/neap excess this data seems to show. The
  // three magnitude thresholds that appeared to agree are nested samples, so
  // they are closer to one observation than three; only the noisiest and most
  // contaminated of them clears significance; and the directional test was
  // picked after an eight-bin version came out messy. At daily resolution the
  // predicted two humps are simply absent, which is the honest answer.
  built.push(panel(copy.correlations.moonQuestion, copy.correlations.moonVerdict, copy.correlations.moonExplain,
    (w) => binChart(lunarBins(times), w, {
      ticks: ["1", "5", "10", "15", "20", "25", "30"],
      markers: [{ at: "1", label: copy.correlations.moonNewMoon },
                { at: String(FULL_MOON_DAY), label: copy.correlations.moonFullMoon }],
    }),
    { label: copy.correlations.moonLink, url: TIDES_ARTICLE },
    fill(copy.correlations.moonSubtitle, { since }), legend));

  if (context.temperature) {
    const points = seriesPoints(context.temperature, yearly);
    const v = scatterVerdict(pearson(points.map((p) => p.x), points.map((p) => p.y)),
                             copy.correlations.climateDriver);
    built.push(panel(copy.correlations.climateQuestion, v.verdict,
      `${v.note} ${copy.correlations.climateExplain}`,
      (w) => scatterChart(points, w, copy.correlations.climateAxis,
                          fill(copy.correlations.scatterYAxis, { threshold: `M${MIN_MAGNITUDE}+` })),
      undefined, fill(copy.correlations.scatterSubtitle, { from: FIRST_YEAR })));
  }

  if (context.sunspots) {
    const points = seriesPoints(context.sunspots, yearly);
    const v = scatterVerdict(pearson(points.map((p) => p.x), points.map((p) => p.y)),
                             copy.correlations.solarDriver);
    built.push(panel(copy.correlations.solarQuestion, v.verdict,
      `${v.note} ${copy.correlations.solarExplain}`,
      (w) => scatterChart(points, w, copy.correlations.solarAxis,
                          fill(copy.correlations.scatterYAxis, { threshold: `M${MIN_MAGNITUDE}+` })),
      undefined, fill(copy.correlations.scatterSubtitle, { from: FIRST_YEAR })));
  }

  if (context.oklahoma) {
    const rows = Object.entries(context.oklahoma.years)
      .map(([year, count]) => ({ year: Number(year), count }))
      .filter((d) => d.year <= lastComplete)
      .sort((a, b) => a.year - b.year);
    const background = rows.filter((d) => d.year <= OKLAHOMA_BACKGROUND_END);
    const rate = background.reduce((a, b) => a + b.count, 0) / Math.max(1, background.length);
    const peak = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]);

    built.push(panel(copy.correlations.oklahomaQuestion, copy.correlations.oklahomaVerdict,
      fill(copy.correlations.oklahomaExplain, {
        rate: rate.toFixed(0), peakYear: peak.year, peak: peak.count.toLocaleString(),
      }),
      (w) => Plot.plot({
        width: w,
        height: Math.max(210, Math.min(270, w * 0.31)),
        marginLeft: 68, marginRight: 14, marginBottom: 38, marginTop: 12,
        style: { background: "transparent", color: theme.text, fontSize: "12px" },
        x: { label: null, tickFormat: "d", interval: 1, ticks: 8, tickSize: 0, tickPadding: 8 },
        y: { label: copy.correlations.oklahomaAxis, labelAnchor: "center", labelOffset: 52,
             grid: true, zero: true },
        color: { type: "identity" },
        marks: [
          Plot.rectY(rows, {
            x: "year", y: "count", fill: theme.up, fillOpacity: 0.85,
            insetLeft: 0.5, insetRight: 0.5,
          }),
          // The background rate is the comparison that makes the bars mean
          // something; without it the reader has no idea what is normal here.
          Plot.ruleY([rate], { stroke: theme.muted, strokeWidth: 1.5, strokeDasharray: "4,3" }),
          Plot.ruleY([0], { stroke: theme.axis }),
          Plot.tip(rows, Plot.pointerX({
            x: "year", y: "count",
            fill: theme.surface, stroke: theme.axis, textPadding: 9, fontSize: 11,
            title: (d: { year: number; count: number }) =>
              `${d.year}\n${d.count.toLocaleString()} earthquakes\n` +
              `${(d.count / Math.max(1, rate)).toFixed(0)}× the pre-2009 rate`,
          })),
        ],
      }),
      undefined, copy.correlations.oklahomaSubtitle,
      [{ color: theme.up, label: copy.correlations.oklahomaLegendBars },
       { color: theme.muted, dashed: true,
         label: fill(copy.correlations.oklahomaLegendRate, { rate: rate.toFixed(0) }) }]));
  }

  el.panels.replaceChildren(...built);
  for (const fn of redraw) fn();

  el.method.textContent = fill(copy.correlations.method, {
    count: times.length.toLocaleString(), binMagnitude: BIN_MAGNITUDE,
    from: FIRST_YEAR, yearMagnitude: MIN_MAGNITUDE,
  });

  const sources = ["USGS ComCat"];
  for (const s of [context.temperature, context.sunspots]) if (s) sources.push(s.source);
  el.sources.textContent = fill(copy.correlations.sources, { list: sources.join("; ") });
}

let resizeTimer: number | undefined;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { for (const fn of redraw) fn(); }, 150);
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  theme = readTheme(document.body);
  for (const fn of redraw) fn();
});

void boot();
