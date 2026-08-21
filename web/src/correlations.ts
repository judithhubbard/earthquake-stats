import * as Plot from "@observablehq/plot";
import { CatalogStore, DATA_BASE, loadMeta, type Meta, type Tier } from "./catalog";
import { readTheme, type Theme } from "./chart";
import { MIN_MAGNITUDE, dayIndex } from "./stats";
import { copy, fill } from "./copy";
import { renderTech } from "./tech";
import { flipTable } from "./verdict";
import { checkCatalog, showProblem } from "./integrity";
import { startAnalytics } from "./analytics";
import {
  FULL_MOON_DAY, chiSquare, chiSquareP, correlationP, lunarBins, monthBins,
  pearson, weekdayBins,
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
  answerTable: document.getElementById("answer-table")!,
  panels: document.getElementById("panels")!,
  sources: document.getElementById("sources")!,
  techTitle: document.getElementById("tech-title")!,
  techBody: document.getElementById("tech-body")!,
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
               subtitle?: string, legend?: LegendKey[],
               flip?: HTMLElement): HTMLElement {
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
  // innerHTML, not textContent: some explanations carry an inline link. The copy
  // is ours rather than user input, so there is nothing to sanitise.
  caption.innerHTML = note;

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
  // What the test would have to read for the answer above to change. The page
  // claims its answers are computed rather than written; this is the claim in a
  // form the reader can hold against the next update.
  if (flip) section.append(flip);

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
        fill: theme.surface, stroke: theme.axis, textPadding: 8, fontSize: 12,
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
        fill: theme.surface, stroke: theme.axis, textPadding: 8, fontSize: 12,
        title: (d: { year: number; x: number; y: number }) =>
          `${d.year}\n${d.y.toLocaleString()} earthquakes\n${xLabel}: ${d.x}`,
      })),
    ],
  });
}

/* ---------------- verdicts ---------------- */


/**
 * The rungs of the verdict, as a table, with the one in force marked.
 *
 * The right-hand column is the verdict strings themselves rather than a
 * paraphrase, so the table cannot end up describing a rule the page does not
 * follow.
 */
/**
 * The two conventional cutoffs, and nothing else.
 *
 * There is no effect-size column any more. It guarded against a difference that
 * is significant but trivial, which on 40,000 events is a real risk -- but the
 * decade-by-decade check is a better guard and catches more: a real pattern
 * stays in the same place, a fluke wanders. Grading by p alone costs a column,
 * a tooltip, and a threshold that would have had to be invented or borrowed
 * from another field.
 */
/**
 * How many questions this page puts a cutoff to: weekday, season, moon,
 * climate, solar. Oklahoma is not one -- it has no statistic.
 *
 * The same five vote on the page's own answer, so the count quoted in the
 * tooltips and the set that decides the headline cannot drift apart.
 */
const TESTS = 5;
const ANY_FLAG = Math.round((1 - 0.95 ** TESTS) * 100);

const P_STRONG = 0.01;
const P_WEAK = 0.05;

interface Outcome { key: "no" | "maybe" | "probably"; p: number; }

function outcomeFor(p: number): Outcome["key"] {
  return p < P_STRONG ? "probably" : p < P_WEAK ? "maybe" : "no";
}

/** A share as a readable percentage: 0.077 reads 8, 0.0004 reads "under 1". */
function asPercent(share: number): string {
  const pct = share * 100;
  return pct < 1 ? "under 1" : pct.toFixed(0);
}

function binOutcome(bins: Bin[]): Outcome {
  const test = chiSquare(bins);
  return { key: outcomeFor(chiSquareP(test.statistic, test.df)),
           p: chiSquareP(test.statistic, test.df) };
}

/** "Probably." / "Maybe." / "No." -- the whole ladder. */
/**
 * The closing paragraph belonging to an outcome, or nothing at all for a "no".
 *
 * Probably and Maybe would otherwise share one, because the prose branches on
 * no-versus-not-no while the verdict has three rungs -- so a panel could say
 * "Probably." above a paragraph calling itself "not a full answer".
 */
function closing(key: Outcome["key"], maybe: string, probably: string): string[] {
  return key === "no" ? [] : [key === "probably" ? probably : maybe];
}

function plainVerdict(key: Outcome["key"]): string {
  const c = copy.correlations;
  return key === "probably" ? c.verdictProbably
       : key === "maybe" ? c.verdictMaybe
       : c.verdictNo;
}

function binFlip(bins: Bin[]): HTMLElement {
  const test = chiSquare(bins);
  const p = chiSquareP(test.statistic, test.df);
  const c = copy.correlations;
  const current = p < P_STRONG ? 0 : p < P_WEAK ? 1 : 2;
  return flipTable(
    [{ label: c.flipColP,
       help: { label: c.flipHelp,
               body: fill(c.flipHelpBody,
                          { p: asPercent(p), tests: TESTS, anyFlag: ANY_FLAG }) } },
     { label: c.flipColAnswer }],
    [
      [c.flipPStrong, c.verdictProbably],
      [c.flipPWeak, c.verdictMaybe],
      [c.flipPNone, c.verdictNo],
    ],
    current,
    [fill(c.flipNow, { value: `${asPercent(p)}%` }), null],
  );
}

/**
 * The scatter verdict carries a direction as well as a strength, so its table
 * runs from a strong positive relationship down to a strong negative one, with
 * no relationship in the middle.
 */
function scatterVerdict(c: Correlation | null, up: string, down: string): string {
  if (!c) return copy.correlations.verdictNotEnough;
  const key = outcomeFor(correlationP(c.r, c.n));
  if (key === "no") return copy.correlations.verdictNo;
  return fill(copy.correlations.verdictDirected, {
    strength: key === "probably" ? "Probably" : "Maybe",
    direction: c.r > 0 ? up : down,
  });
}

function scatterFlip(c: Correlation | null, up: string, down: string): HTMLElement | undefined {
  if (!c) return undefined;
  const t = copy.correlations;
  const p = correlationP(c.r, c.n);
  const key = outcomeFor(p);
  const current = key === "no" ? 2
                : c.r > 0 ? (key === "probably" ? 0 : 1)
                : (key === "probably" ? 4 : 3);
  const say = (strength: string, direction: string) =>
    fill(t.verdictDirected, { strength, direction });
  return flipTable(
    [{ label: t.flipColR,
       help: { label: t.flipHelpR, body: t.flipHelpRBody } },
     { label: t.flipColP,
       help: { label: t.flipHelpRP,
               body: fill(t.flipHelpRPBody,
                          { years: c.n, p: asPercent(p), tests: TESTS, anyFlag: ANY_FLAG }) } },
     { label: t.flipColAnswer }],
    [
      [t.flipRUp, t.flipPStrong, say("Probably", up)],
      [t.flipRUp, t.flipPWeak, say("Maybe", up)],
      [t.flipRAny, t.flipPNone, t.verdictNo],
      [t.flipRDown, t.flipPWeak, say("Maybe", down)],
      [t.flipRDown, t.flipPStrong, say("Probably", down)],
    ],
    current,
    [fill(t.flipNow, { value: c.r.toFixed(2) }),
     fill(t.flipNow, { value: `${asPercent(p)}%` }), null],
  );
}

/**
 * The page's own answer, graded like a panel but on the corrected p-value.
 *
 * The smallest of the five decides which rung, after correcting for having
 * asked five questions: 1 - (1 - p)^5, the chance of seeing one at least that
 * small somewhere among them. The correction lands on the same 1% and 5% lines
 * the panels use, since 1 - (1 - 0.0102)^5 is 0.05.
 *
 * Without it the page contradicted itself -- it blanked its headline whenever
 * any panel crossed, while its own tooltip explained that one crossing out of
 * five is roughly what chance produces.
 */
/**
 * The page's own answer, from the five tests below it.
 *
 * Graded on the combined number, not the smallest of the five. Reporting the
 * best of five tests as though it were the only one is what makes a page like
 * this untrustworthy.
 *
 * Sidak's 1 - (1 - p)^5 is only valid when the five are independent, which was
 * measured rather than assumed. Weekday, month and lunar day are three clocks
 * that do not divide into one another -- 7 days, 365.25 days and 29.53 days --
 * so over fifty years an earthquake's position on one carries no information
 * about its position on the others. The two yearly comparisons do share a count
 * series, so they were tested as a pair by permuting the year labels: the
 * correlation between their statistics came out at +0.01, and the combined
 * p-value agrees with Sidak to four decimal places at every rung the page
 * grades on. The nested-series problem that rules Sidak out for the trend
 * section on the front page does not arise here.
 */
function writePageAnswer(tests: { p: number; subject: string }[]) {
  const c = copy.correlations;
  const closest = tests.reduce((a, b) => (b.p < a.p ? b : a));
  const corrected = 1 - (1 - closest.p) ** tests.length;
  const key = outcomeFor(corrected);

  el.answer.innerHTML = key === "probably" ? c.answerProbably
                      : key === "maybe" ? c.answerMaybe
                      : c.answer;
  el.answerDetail.textContent = key === "no" ? c.detail
    : fill(key === "probably" ? c.detailProbably : c.detailMaybe, {
        subject: closest.subject, tests: tests.length,
        corrected: asPercent(corrected),
      });

  // One deciding column. The smallest of the five is still reported -- in the
  // help text and under its own panel -- where it cannot be mistaken for the
  // number the answer rests on.
  el.answerTable.replaceChildren(flipTable(
    [{ label: c.pageColCombined,
       help: { label: c.pageHelp,
               body: fill(c.pageHelpBody, {
                 tests: tests.length, anyFlag: ANY_FLAG,
                 subject: closest.subject, p: asPercent(closest.p),
                 corrected: asPercent(corrected),
               }) } },
     { label: c.flipColAnswer }],
    [
      [c.flipPStrong, c.verdictProbably],
      [c.flipPWeak, c.verdictMaybe],
      [c.flipPNone, c.verdictNo],
    ],
    key === "probably" ? 0 : key === "maybe" ? 1 : 2,
    [fill(c.flipNow, { value: `${asPercent(corrected)}%` }), null],
  ));
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

/**
 * Mainshock times at or above `minMag`, from `firstYear` onward, plus the
 * number of events that were considered.
 *
 * The panels only ever plot the mainshocks, but the prose has to be able to say
 * how many earthquakes went in and how many came out -- quoting the surviving
 * count on its own reads as though it were the whole catalogue, and here it is
 * barely half of it.
 */
function mainshockTimes(tier: Tier, minMag: number, firstYear: number):
    { times: number[]; raw: number } {
  const times: number[] = [];
  let raw = 0;
  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] < minMag) continue;
    if (dayIndex(tier.time[i]).year < firstYear) continue;
    raw++;
    if (!tier.dependent[i]) times.push(tier.time[i]);
  }
  return { times, raw };
}

/** Events at or above `minMag` in complete years, before and after declustering. */
function annualTotals(tier: Tier, minMag: number, firstYear: number, lastYear: number):
    { raw: number; kept: number } {
  let raw = 0, kept = 0;
  for (let i = 0; i < tier.n; i++) {
    if (tier.mag[i] < minMag) continue;
    const { year } = dayIndex(tier.time[i]);
    if (year < firstYear || year > lastYear) continue;
    raw++;
    if (!tier.dependent[i]) kept++;
  }
  return { raw, kept };
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

  const problem = checkCatalog(meta);
  if (problem) showProblem(problem);

  const store = new CatalogStore(meta);
  const [fine, coarse] = await Promise.all([
    store.load(BIN_MAGNITUDE), store.load(MIN_MAGNITUDE),
  ]);

  theme = readTheme(document.body);
  const { times, raw } = mainshockTimes(fine, BIN_MAGNITUDE, FIRST_YEAR);
  const lastComplete = dayIndex(Date.now()).year - 1;
  const yearly = annualCounts(coarse, MIN_MAGNITUDE, FIRST_YEAR, lastComplete);
  const annual = annualTotals(coarse, MIN_MAGNITUDE, FIRST_YEAR, lastComplete);
  const kept = times.length.toLocaleString();

  // Set after the panels, once their outcomes are known -- see the end of boot.
  // Every panel that runs a test votes, which is all of them but Oklahoma: that
  // one has no statistic and answers a different question.
  // Each entry is one test's p-value and what it is a test of, so the page can
  // both grade itself and name whichever question is closest.
  const headline: { p: number; subject: string }[] = [];
  el.answerDetail.textContent = copy.correlations.detail;

  const legend: LegendKey[] = [
    { color: theme.bandNeutral, label: copy.correlations.legendBand, band: true },
    { color: theme.up, label: copy.correlations.legendAbove },
    { color: theme.down, label: copy.correlations.legendBelow },
  ];
  const since = fill(copy.correlations.subtitleSince,
    { threshold: BIN_MAGNITUDE, from: FIRST_YEAR });

  const built: HTMLElement[] = [];

  // The busiest day, not the furthest from average: the sentence says "more
  // earthquakes occur on", so it has to name a day that is actually above it.
  const weekday = weekdayBins(times);
  const busiest = weekday.reduce((a, b) => (b.deviation > a.deviation ? b : a));
  const weekdayOut = binOutcome(weekday);
  headline.push({ p: weekdayOut.p, subject: copy.correlations.weekdaySubject });
  built.push(panel(copy.correlations.weekdayQuestion,
    plainVerdict(weekdayOut.key),
    fill([copy.correlations.weekdayIntro,
          weekdayOut.key === "no"
            ? copy.correlations.weekdayTail
            : [copy.correlations.weekdayFlipped,
               ...closing(weekdayOut.key, copy.correlations.maybeBin,
                          copy.correlations.probablyBin)].join("\n\n"),
         ].join("\n\n"), {
      p: asPercent(weekdayOut.p),
      noBin: fill(copy.correlations.noBin,
                  { p: asPercent(weekdayOut.p), subject: "the day of the week" }),
      threshold: `M${BIN_MAGNITUDE}+`, from: FIRST_YEAR,
      raw: raw.toLocaleString(), count: kept,
      bin: busiest.full,
      percent: busiest.deviation.toFixed(1),
    }),
    (w) => binChart(weekday, w), undefined,
    fill(copy.correlations.weekdaySubtitle, { since }), legend, binFlip(weekday)));

  const month = monthBins(times);
  const ranked = [...month].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  const gap = Math.abs(month.indexOf(ranked[0]) - month.indexOf(ranked[1]));
  const word = (d: number) => (d >= 0 ? "more" : "fewer");
  const monthOut = binOutcome(month);
  headline.push({ p: monthOut.p, subject: copy.correlations.monthSubject });
  built.push(panel(copy.correlations.monthQuestion,
    plainVerdict(monthOut.key),
    [
      fill(copy.correlations.monthIntro, { count: kept }),
      // December and January are adjacent too, hence the wrap.
      fill(gap === 1 || gap === 11
        ? copy.correlations.monthPairAdjacent
        : copy.correlations.monthPairApart, {
        bin1: ranked[0].full, pct1: Math.abs(ranked[0].deviation).toFixed(1),
        dir1: word(ranked[0].deviation),
        bin2: ranked[1].full, pct2: Math.abs(ranked[1].deviation).toFixed(1),
        dir2: word(ranked[1].deviation),
      }),
      monthOut.key === "no"
        ? fill(copy.correlations.noBin,
               { p: asPercent(monthOut.p), subject: "the month" })
          + "\n\n" + copy.correlations.monthExplain
        : [copy.correlations.monthFlipped,
           ...closing(monthOut.key, copy.correlations.maybeBin,
                      copy.correlations.probablyBin)]
            .map((t) => fill(t, { p: asPercent(monthOut.p) })).join("\n\n"),
    ].join("\n\n"),
    (w) => binChart(month, w), undefined,
    fill(copy.correlations.monthSubtitle, { since }), legend, binFlip(month)));

  // We do not claim the small spring/neap excess this data seems to show. The
  // three magnitude thresholds that appeared to agree are nested samples, so
  // they are closer to one observation than three; only the noisiest and most
  // contaminated of them clears significance; and the directional test was
  // picked after an eight-bin version came out messy. At daily resolution the
  // predicted two humps are simply absent, which is the honest answer.
  const moon = lunarBins(times);
  const moonOut = binOutcome(moon);
  headline.push({ p: moonOut.p, subject: copy.correlations.moonSubject });
  built.push(panel(copy.correlations.moonQuestion, plainVerdict(moonOut.key),
    fill([copy.correlations.moonOpen,
          moonOut.key === "no"
            ? fill(copy.correlations.moonTail, {
                noBin: fill(copy.correlations.noBin,
                            { p: asPercent(moonOut.p), subject: "the lunar day" }),
              })
            : [copy.correlations.moonFlipped,
               ...closing(moonOut.key, copy.correlations.maybeBin,
                          copy.correlations.probablyBin)].join("\n\n"),
          copy.correlations.moonRest].join("\n\n"), {
      article: TIDES_ARTICLE, count: kept, p: asPercent(moonOut.p),
    }),
    (w) => binChart(moon, w, {
      ticks: ["1", "5", "10", "15", "20", "25", "30"],
      markers: [{ at: "1", label: copy.correlations.moonNewMoon },
                { at: String(FULL_MOON_DAY), label: copy.correlations.moonFullMoon }],
    }),
    undefined,
    fill(copy.correlations.moonSubtitle, { since }), legend, binFlip(moon)));

  if (context.temperature) {
    const points = seriesPoints(context.temperature, yearly);
    const c = pearson(points.map((p) => p.x), points.map((p) => p.y));
    headline.push({ p: c ? correlationP(c.r, c.n) : 1,
                    subject: copy.correlations.climateSubject });
    // Whether the panel has anything to explain, on the same rule as its verdict.
    const cUp = copy.correlations.climateUp;
    const cDown = copy.correlations.climateDown;
    built.push(panel(copy.correlations.climateQuestion, scatterVerdict(c, cUp, cDown),
      fill([outcomeFor(correlationP(c!.r, c!.n)) !== "no"
              ? copy.correlations.climateOpenFlipped
              : copy.correlations.climateOpen,
            copy.correlations.climateMiddle,
            outcomeFor(correlationP(c!.r, c!.n)) !== "no"
              ? copy.correlations.climateCloseFlipped
              : copy.correlations.climateCloseNo,
            ...closing(c ? outcomeFor(correlationP(c.r, c.n)) : "no",
                       copy.correlations.maybeScatter,
                       copy.correlations.probablyScatter),
           ].join("\n\n"), {
        threshold: `M${MIN_MAGNITUDE}+`, p: asPercent(correlationP(c!.r, c!.n)),
        tierRaw: annual.raw.toLocaleString(), tierCount: annual.kept.toLocaleString(),
        years: lastComplete - FIRST_YEAR + 1, from: FIRST_YEAR,
        binThreshold: `M${BIN_MAGNITUDE}+`,

        stat: c === null ? "" : fill(
          outcomeFor(correlationP(c.r, c.n)) !== "no"
            ? copy.correlations.climateStatSignificant
            : copy.correlations.climateStatNull,
          { years: c.n, r: c.r.toFixed(2), critical: c.critical.toFixed(2),
            p: asPercent(correlationP(c!.r, c!.n)) }),
      }),
      (w) => scatterChart(points, w, copy.correlations.climateAxis,
                          fill(copy.correlations.scatterYAxis, { threshold: `M${MIN_MAGNITUDE}+` })),
      undefined, fill(copy.correlations.scatterSubtitle, { from: FIRST_YEAR }),
      undefined, scatterFlip(c, cUp, cDown)));
  }

  if (context.sunspots) {
    const points = seriesPoints(context.sunspots, yearly);
    const c = pearson(points.map((p) => p.x), points.map((p) => p.y));
    headline.push({ p: c ? correlationP(c.r, c.n) : 1,
                    subject: copy.correlations.solarSubject });
    const sUp = copy.correlations.solarUp;
    const sDown = copy.correlations.solarDown;
    built.push(panel(copy.correlations.solarQuestion, scatterVerdict(c, sUp, sDown),
      fill([copy.correlations.solarExplain,
            ...closing(c ? outcomeFor(correlationP(c.r, c.n)) : "no",
                       copy.correlations.maybeScatter,
                       copy.correlations.probablyScatter),
           ].join("\n\n"), {
        threshold: `M${MIN_MAGNITUDE}+`, p: asPercent(correlationP(c!.r, c!.n)),
        tierRaw: annual.raw.toLocaleString(), tierCount: annual.kept.toLocaleString(),
        years: lastComplete - FIRST_YEAR + 1, from: FIRST_YEAR,
        binThreshold: `M${BIN_MAGNITUDE}+`,

        stat: c === null ? "" : fill(
          outcomeFor(correlationP(c.r, c.n)) !== "no"
            ? copy.correlations.solarStatSignificant
            : copy.correlations.solarStatNull,
          { years: c.n, r: c.r.toFixed(2), critical: c.critical.toFixed(2),
            p: asPercent(correlationP(c!.r, c!.n)) }),
      }),
      (w) => scatterChart(points, w, copy.correlations.solarAxis,
                          fill(copy.correlations.scatterYAxis, { threshold: `M${MIN_MAGNITUDE}+` })),
      undefined, fill(copy.correlations.scatterSubtitle, { from: FIRST_YEAR }),
      undefined, scatterFlip(c, sUp, sDown)));
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
        // Computed rather than asserted: the peak is ~286x the background rate,
        // not the hundredfold that gets quoted.
        ratio: Math.round(peak.count / Math.max(rate, 1e-9)),
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
            fill: theme.surface, stroke: theme.axis, textPadding: 8, fontSize: 12,
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

  // A hard-coded "No." at the top of a page arguing that its answers are
  // computed would be the same fault the panels just had. If any of the four
  // has stopped saying no, the page stops saying it too and leaves the sentence
  // below to speak for itself.
  writePageAnswer(headline);
  el.panels.replaceChildren(...built);
  for (const fn of redraw) fn();

  const sources = ["USGS ComCat"];
  for (const s of [context.temperature, context.sunspots]) if (s) sources.push(s.source);
  el.sources.textContent = fill(copy.correlations.sources, { list: sources.join("; ") });
}

let resizeTimer: number | undefined;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { for (const fn of redraw) fn(); }, 150);
});
renderTech(copy.correlations.techTitle, copy.correlations.techBody, el.techTitle, el.techBody);
startAnalytics();
void boot();
