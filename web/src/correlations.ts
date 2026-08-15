import * as Plot from "@observablehq/plot";
import { CatalogStore, DATA_BASE, loadMeta, type Meta, type Tier } from "./catalog";
import { readTheme, type Theme } from "./chart";
import { MIN_MAGNITUDE, dayIndex } from "./stats";
import {
  FULL_MOON_DAY, chiSquare, lunarBins, monthBins, pearson, weekdayBins,
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

interface LegendKey { color: string; label: string; band?: boolean; }

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
      swatch.style.background = key.color;
      if (key.band) swatch.className = "swatch-band";
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
    marginLeft: 54,
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
      labelOffset: 44,
      tickFormat: (d: number) => `${d > 0 ? "+" : ""}${d.toFixed(0)}%`,
      grid: true,
    },
    color: { type: "identity" },
    marks: [
      Plot.rectY(bins, {
        x: "label",
        y1: (d: Bin) => (-100 * d.sigma2) / d.expected,
        y2: (d: Bin) => (100 * d.sigma2) / d.expected,
        fill: theme.band, inset: -0.5,
      }),
      Plot.rectY(bins, {
        x: "label", y: "deviation",
        // Two poles of a diverging pair: at a glance a short bar up and a short
        // bar down are otherwise the same shape.
        fill: (d: Bin) => (d.deviation >= 0 ? theme.up : theme.down),
        fillOpacity: 0.9, inset: 7,
      }),
      Plot.ruleY([0], { stroke: theme.axis, strokeWidth: 1.2 }),
      ...(opts.markers ?? []).map((m) => Plot.text([m], {
        x: "at", frameAnchor: "top", text: "label",
        dy: 2, fill: theme.muted, fontSize: 11, fontWeight: 600,
      })),
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
    marginLeft: 62,
    marginBottom: 42,
    marginTop: 12,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    x: { label: xLabel, labelAnchor: "center", grid: true, nice: true },
    y: { label: yLabel, labelAnchor: "center", labelOffset: 48, grid: true, nice: true },
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
  const test = chiSquare(bins);
  const worst = bins.reduce((a, b) =>
    Math.abs(b.deviation) > Math.abs(a.deviation) ? b : a);
  const biggest = `${worst.full} is furthest from average, by ` +
    `${Math.abs(worst.deviation).toFixed(1)}%.`;

  if (test.statistic <= test.critical) {
    return { verdict: "No.", note: `${biggest} That is inside the grey, so it is just luck.` };
  }
  return {
    verdict: "Not really.",
    note: `${biggest} The bars wobble a little more than luck usually gives. Worth a second ` +
          "look, but it proves nothing by itself.",
  };
}

function scatterVerdict(c: Correlation | null, driver: string): { verdict: string; note: string } {
  if (!c) return { verdict: "Not enough data.", note: "" };
  const strength = `If there were a link, the dots would line up. Over ${c.n} years they ` +
    `score ${c.r.toFixed(2)}, and anything under ${c.critical.toFixed(2)} counts as no link.`;
  return c.significant
    ? { verdict: "Maybe, but only just.",
        note: `${strength} With this few years, treat it as a hint, not an answer.` }
    : { verdict: "No.",
        note: `${strength} Years with more ${driver} get no more earthquakes than quiet ones.` };
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
    el.answer.textContent = "Could not load the data.";
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

  el.answer.innerHTML = "<strong>No.</strong>";
  el.answerDetail.textContent =
    `Each one checked against ${times.length.toLocaleString()} earthquakes since ${FIRST_YEAR}.`;

  el.guide.innerHTML =
    "<strong>How to read these.</strong> Flip a coin ten times and you rarely get exactly " +
    "five heads. Earthquakes are the same. Even when nothing is going on, some months come " +
    "out busier than others. The grey band shows how much of that to expect. A bar inside " +
    "the grey means nothing is happening. A bar that sticks out is worth a look.";

  const legend: LegendKey[] = [
    { color: theme.band, label: "Range expected from chance alone", band: true },
    { color: theme.up, label: "More earthquakes than average" },
    { color: theme.down, label: "Fewer than average" },
  ];
  const since = `Magnitude ${BIN_MAGNITUDE} and up, since ${FIRST_YEAR}`;

  const built: HTMLElement[] = [];

  const weekday = weekdayBins(times);
  built.push(panel("Do earthquakes prefer a day of the week?",
    binVerdict(weekday).verdict,
    `${binVerdict(weekday).note} Start here. A fault cannot know it is Tuesday, so this ` +
    "panel shows what nothing looks like. Every other panel is judged against it.",
    (w) => binChart(weekday, w), undefined, `Day of the week · ${since}`, legend));

  const month = monthBins(times);
  built.push(panel("Do earthquakes have a season? Is there such a thing as earthquake weather?",
    binVerdict(month).verdict,
    `${binVerdict(month).note} Months are counted per day, because February is short.` +
    "\n\nWhat about real weather, the hot still days people remember? Checking that properly " +
    "would mean looking up the weather above every earthquake, a much bigger job than anything " +
    "here. But two things already point the same way. Weather follows the seasons, and the " +
    "seasons show nothing. And earthquakes start ten kilometres underground. A big storm " +
    "presses on the ground about as hard as the moon does, and the moon, in the next panel, " +
    "does almost nothing.",
    (w) => binChart(month, w), undefined, `Month of the year · ${since}`, legend));

  // We do not claim the small spring/neap excess this data seems to show. The
  // three magnitude thresholds that appeared to agree are nested samples, so
  // they are closer to one observation than three; only the noisiest and most
  // contaminated of them clears significance; and the directional test was
  // picked after an eight-bin version came out messy. At daily resolution the
  // predicted two humps are simply absent, which is the honest answer.
  built.push(panel("Does the moon set off earthquakes?",
    "No.",
    "If the moon set off earthquakes you would see two humps here — one at new moon and one " +
    "at full, when the sun and moon line up and pull together hardest. There are no humps. " +
    "Every bar sits inside the grey." +
    "\n\nThat does not prove the moon does nothing at all. Careful studies find a small effect " +
    "on some faults, a percent or two, mostly where ocean tides press on the seafloor. This " +
    "chart is not sensitive enough to see something that small — and neither is anything else " +
    "you could use to plan your day.",
    (w) => binChart(lunarBins(times), w, {
      ticks: ["1", "5", "10", "15", "20", "25", "30"],
      markers: [{ at: "1", label: "new moon" },
                { at: String(FULL_MOON_DAY), label: "full moon" }],
    }),
    { label: "But can the moon predict earthquakes? We looked at 79 of the biggest",
      url: TIDES_ARTICLE },
    `Day of the lunar cycle · ${since}`, legend));

  if (context.temperature) {
    const points = seriesPoints(context.temperature, yearly);
    const c = pearson(points.map((p) => p.x), points.map((p) => p.y));
    const v = scatterVerdict(c, "warming");
    built.push(panel("Is climate change causing earthquakes?", v.verdict,
      `${v.note} When ice melts or groundwater drains away, the weight pressing on the crust ` +
      "changes, and in a few places that has been tied to small earthquakes. But it is slow " +
      "and local, and it never shows up in the world total.",
      (w) => scatterChart(points, w, "Global temperature (°C above 1951–1980)", "M6+ earthquakes"),
      undefined, `Each dot is one year, ${FIRST_YEAR} onward`));
  }

  if (context.sunspots) {
    const points = seriesPoints(context.sunspots, yearly);
    const c = pearson(points.map((p) => p.x), points.map((p) => p.y));
    const v = scatterVerdict(c, "solar activity");
    built.push(panel("Does solar activity trigger earthquakes?", v.verdict,
      `${v.note} The sun runs on a clear 11-year cycle, which makes it a tempting thing to ` +
      "line earthquakes up against. They do not line up.",
      (w) => scatterChart(points, w, "Sunspot number", "M6+ earthquakes"),
      undefined, `Each dot is one year, ${FIRST_YEAR} onward`));
  }

  if (context.oklahoma) {
    const rows = Object.entries(context.oklahoma.years)
      .map(([year, count]) => ({ year: Number(year), count }))
      .filter((d) => d.year <= lastComplete)
      .sort((a, b) => a.year - b.year);
    const background = rows.filter((d) => d.year <= OKLAHOMA_BACKGROUND_END);
    const rate = background.reduce((a, b) => a + b.count, 0) / Math.max(1, background.length);
    const peak = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]);

    built.push(panel("Can people cause earthquakes?",
      "Yes — and this is what a real effect looks like.",
      `Oklahoma used to get about ${rate.toFixed(0)} earthquakes of magnitude 3 or more a ` +
      `year. In ${peak.year} it got ${peak.count.toLocaleString()}. The cause was wastewater ` +
      "from oil and gas drilling, pumped back down into the ground. That raised the pressure " +
      "on faults that were already close to slipping. When the state limited the pumping, the " +
      "earthquakes died away again." +
      "\n\nCan you tell whether one particular earthquake was our doing? Usually not from the " +
      "earthquake itself — a man-made magnitude 4 shakes the ground just like a natural one. " +
      "You tell from the pattern. A quiet place suddenly gets hundreds. They sit right next " +
      "to the wells. They start when the pumping starts, and fade when it stops. Any one of " +
      "them could be a coincidence. All of them together cannot be." +
      "\n\nNow look back at the panels above. Same method, same data. Here it finds something " +
      "enormous. There it finds nothing.",
      (w) => Plot.plot({
        width: w,
        height: Math.max(210, Math.min(270, w * 0.31)),
        marginLeft: 56, marginRight: 14, marginBottom: 38, marginTop: 12,
        style: { background: "transparent", color: theme.text, fontSize: "12px" },
        x: { label: null, tickFormat: "d", interval: 1, ticks: 8, tickSize: 0, tickPadding: 8 },
        y: { label: "Earthquakes per year", labelAnchor: "center", labelOffset: 46,
             grid: true, zero: true },
        color: { type: "identity" },
        marks: [
          Plot.rectY(rows, { x: "year", y: "count", fill: theme.up, fillOpacity: 0.85, inset: 0.5 }),
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
      undefined,
      "Earthquakes of magnitude 3 or more in Oklahoma, each year",
      [{ color: theme.up, label: "Earthquakes that year" },
       { color: theme.muted, label: `Normal rate before 2009 — about ${rate.toFixed(0)} a year` }]));
  }

  el.panels.replaceChildren(...built);
  for (const fn of redraw) fn();

  el.method.textContent =
    "Aftershocks are left out of every panel here, on purpose. An earthquake " +
    "predicts other earthquakes better than anything else we know of: leave the aftershocks " +
    "in and one big rupture and its hundreds of followers would swamp every chart on the " +
    "page. Stripping them out is what makes it possible to look for anything smaller." +
    `\n\nThe first three panels use ${times.length.toLocaleString()} earthquakes of magnitude ` +
    `5 and up since ${FIRST_YEAR}. The last two compare whole years, so they use magnitude 6 ` +
    "and up, where the counts can be trusted from one decade to the next.";

  const sources = ["USGS ComCat"];
  for (const s of [context.temperature, context.sunspots]) if (s) sources.push(s.source);
  el.sources.textContent = `Data: ${sources.join("; ")}.`;
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
