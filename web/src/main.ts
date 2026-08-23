import { CatalogStore, loadMeta, type Meta, type Tier } from "./catalog";
import { renderAnnualChart, renderChart, renderDistribution,
         readTheme, type Highlight } from "./chart";
import {
  DAYS, MAGNITUDES, MAJOR_MAGNITUDE, MIN_MAGNITUDE, annualCounts, cumulativeByYear,
  dayIndex, empiricalBand,
  equivalentMagnitude, seismicMoment,
  rollingWindowBand,
  verdict,
  type Measure, type YearCurves,
} from "./stats";
import { copy, fill } from "./copy";
import { renderTech } from "./tech";
import { installHintGuard } from "./verdict";
import { checkCatalog, showProblem } from "./integrity";
import { startAnalytics } from "./analytics";

/**
 * First year of the reference window, and the earliest year shown anywhere.
 *
 * 1976 is the start of the Global CMT catalogue. Note that M6+ ComCat counts
 * are NOT stationary across the whole of this window: fitted over 1976-1995
 * they rise 37.5%/decade (t = 6.5) and then flatten (-4.3%/decade, t = -1.4
 * over 1996-2025), which is the global network and routine Mw determination
 * maturing rather than seismicity. The site shows no trend line for that
 * reason. Moving this to 1996 gives a stationary window; it is one constant.
 */
const REFERENCE_START = 1976;

/* Mainshocks first, and the default. A year's count is dominated by whether a
   handful of big sequences happened to fall in it, so "is this year unusual"
   is a question about mainshocks; leaving aftershocks in answers a different
   one. The option to put them back stays, second. */
/* Rolling first, and the default for the cumulative chart: twelve months
   ending today is a complete window, and so is every one it is compared
   against. The calendar year is the part-way-through one. */
const WINDOWS = [
  { id: "rolling", label: "Last 365 days" },
  { id: "calendar", label: "This year" },
] as const;
const CATALOG_MODES = [
  { id: "mainshocks", label: "Mainshocks only" },
  { id: "all", label: "All earthquakes" },
] as const;
// How the reference years are described. Percentiles say what those years did;
// sigma says what a normal fit to them predicts. See BandPoint in stats.ts.
const RANGES = [
  { id: "percentile", label: "50 / 90%" },
  { id: "sigma", label: "±2σ (95.45%)" },
] as const;
// The annual chart has no percentile band to switch between, so its control is
// a plain show/hide -- and it is its own state, not a mirror of the cumulative
// chart's, so the two can be read against each other.
const ANNUAL_RANGES = [
  { id: "off", label: "Off" },
  { id: "sigma", label: "±2σ (95.45%)" },
] as const;


/** Colour slots available to highlighted years; index 0 is the current year. */
const MAX_HIGHLIGHTS = 5;

/**
 * The M4.5+ day feed, not all_day.
 *
 * A strict superset of what this page reads -- the thresholds offered are M6+
 * and M7+, and pollLive filters to those -- at 20 KB against 225 KB. With a
 * poll every 60 seconds and cache: "no-store" forcing a real request, all_day
 * pulled roughly 324 MB a day from USGS per open tab to extract a handful of
 * events. If a threshold below M4.5 is ever offered, this has to go back.
 */
const LIVE_FEED =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
const LIVE_INTERVAL_MS = 60_000;

interface State {
  minMag: number;
  window: (typeof WINDOWS)[number]["id"];
  annualWindow: (typeof WINDOWS)[number]["id"];
  measure: Measure;
  range: (typeof RANGES)[number]["id"];
  annualRange: (typeof ANNUAL_RANGES)[number]["id"];
  catalogMode: (typeof CATALOG_MODES)[number]["id"];
  /** Year -> colour slot. Slots are held until a year is deselected, so
      removing one highlight never repaints the others. */
  highlights: Map<number, number>;
}

const state: State = {
  minMag: MIN_MAGNITUDE,
  window: "rolling",
  // Pinned to the rolling window, so every bar is a complete twelve months and
  // directly comparable, with no part-finished year to project. The cumulative
  // chart below keeps its own switch.
  annualWindow: "rolling",
  // Pinned. The Count/Moment control is parked in attic/measure-control;
  // the moment branches downstream are unreachable but still present.
  measure: "count",
  range: "percentile",
  annualRange: "off",
  catalogMode: "mainshocks",
  highlights: new Map(),
};

/**
 * How far to slide the calendar so the window starts behaving like 1 January.
 *
 * Zero for calendar years. For the rolling view it is the distance from
 * 1 January to *tomorrow*, which makes the twelve months ending today into a
 * complete "year" -- and every past window run to the same date, so a full year
 * is only ever compared against full years.
 */
function calendarShift(window: State["window"] = state.window): number {
  if (window === "calendar") return 0;
  const now = new Date();
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return tomorrow - Date.UTC(now.getUTCFullYear(), 0, 1);
}

/** "2025" for a calendar year, "2025–26" for a window that straddles two. */
function yearLabel(year: number, window: State["window"] = state.window): string {
  return window === "calendar" ? String(year) : `${year}–${String(year + 1).slice(2)}`;
}

/**
 * Moment ignores declustering: aftershocks release real energy, so removing
 * them would undercount a physical quantity. For counts it is the whole point.
 */
const effectiveMainshocksOnly = () =>
  state.measure === "count" && state.catalogMode === "mainshocks";

let meta: Meta;
let store: CatalogStore;
interface LiveEvent {
  id: string;
  time: number;
  lat: number;
  lon: number;
  mag: number;
  place: string;
}
let liveEvents: LiveEvent[] = [];

const el = {
  answer: document.getElementById("answer")!,
  answerAggregate: document.getElementById("answer-aggregate")!,
  answerDetail: document.getElementById("answer-detail")!,
  answerSummary: document.getElementById("answer-summary")!,
  latest: document.getElementById("latest")!,
  mag: document.getElementById("mag-control")!,
  catalog: document.getElementById("catalog-control")!,
  window: document.getElementById("window-control")!,
  yearPicker: document.getElementById("year-picker")!,
  yearToggle: document.getElementById("year-toggle") as HTMLButtonElement,
  yearPanel: document.getElementById("year-panel")!,
  yearSummary: document.getElementById("year-summary")!,
  yearCount: document.getElementById("year-count")!,
  yearClear: document.getElementById("year-clear") as HTMLButtonElement,
  yearList: document.getElementById("year-list")!,
  chart: document.getElementById("chart")!,
  chartTitle: document.getElementById("chart-title")!,
  chartNote: document.getElementById("chart-note")!,
  annualChart: document.getElementById("annual-chart")!,
  annualTitle: document.getElementById("annual-title")!,
  annualNote: document.getElementById("annual-note")!,
  range: document.getElementById("range-control")!,
  annualRange: document.getElementById("annual-range-control")!,
  scaleTitle: document.getElementById("scale-title")!,
  scaleBar: document.getElementById("scale-bar")!,
  scaleBasis: document.getElementById("scale-basis")!,
  scaleRows: document.getElementById("scale-rows")!,
  generated: document.getElementById("generated")!,
  techTitle: document.getElementById("tech-title")!,
  techBody: document.getElementById("tech-body")!,
};

const magLabel = (m: number) => `M${m.toFixed(1).replace(/\.0$/, "")}+`;

/** Counts round to whole events; moment keeps three significant figures. */
function fmt(n: number): string {
  if (state.measure === "count") return Math.round(n).toLocaleString();
  if (n === 0) return "0";
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** What one number of this measure is called, e.g. "90" vs "12.4 ×10²⁰ N·m". */
function withUnit(n: number): string {
  return state.measure === "moment" ? `${fmt(n)} ×10²⁰ N·m` : fmt(n);
}

/**
 * Which headline a percentile earns.
 *
 * The scale at the foot of the page is built by calling this at the midpoint of
 * each band, so the two cannot describe different rules -- the table is not a
 * restatement of these thresholds, it is their output.
 */
function answerFor(pct: number, rolling: boolean): string {
  if (pct > 95) return rolling ? copy.home.rollingBusiest : copy.home.answerBusiest;
  if (pct < 5) return rolling ? copy.home.rollingQuietest : copy.home.answerQuietest;
  if (pct >= 75) return rolling ? copy.home.rollingBusy : copy.home.answerBusy;
  if (pct <= 25) return rolling ? copy.home.rollingQuiet : copy.home.answerQuiet;
  return rolling ? copy.home.rollingAverage : copy.home.answerAverage;
}

/**
 * The boundaries those rules turn on. Kept beside answerFor rather than derived
 * from it -- a function cannot be asked where its own thresholds are -- so a
 * change to one wants a change to the other.
 */
const ANSWER_BOUNDS = [0, 5, 25, 75, 95, 100];

/** 1st, 2nd, 3rd, 61st -- the copy used to append a literal "th". */
function ordinal(n: number): string {
  const v = Math.round(n);
  const suffix = v % 100 >= 11 && v % 100 <= 13
    ? "th"
    : ["th", "st", "nd", "rd"][v % 10] ?? "th";
  return `${v}${suffix}`;
}


/** Colour per band, palest in the middle: blue below average, red above. */
const BAND_TINTS = ["down", "down", "mid", "up", "up"] as const;
const BAND_FADES = [1, 0.45, 1, 0.45, 1];

/**
 * Every headline the page can print, with the slice of the percentile range
 * that earns it and how often that slice comes up.
 *
 * Each row's text is answerFor() called at the middle of its band, so this is
 * the rule's output rather than a second copy of it. The width of a row is the
 * width of its band, which is also the number of years in a hundred: the
 * percentile is uniform by construction, so a band 20 points wide is 20 years.
 */
function buildAnswerScale(pct: number | null, year: string) {
  const bands = ANSWER_BOUNDS.slice(0, -1).map((low, i) => {
    const high = ANSWER_BOUNDS[i + 1];
    return {
      low, high, width: high - low,
      // The sentences the headline can print, which are now the rolling set.
      text: fill(answerFor((low + high) / 2, true), { year, from: REFERENCE_START }),
      tint: BAND_TINTS[i], fade: BAND_FADES[i],
    };
  });

  el.scaleTitle.textContent = copy.home.scaleTitle;

  el.scaleBar.replaceChildren(...bands.map((b) => {
    const seg = document.createElement("span");
    seg.className = `scale-seg scale-${b.tint}`;
    seg.style.flexGrow = String(b.width);
    seg.style.opacity = String(b.fade);
    return seg;
  }));
  if (pct !== null) {
    const marker = document.createElement("span");
    marker.className = "scale-marker";
    marker.style.left = `${pct}%`;

    const tag = document.createElement("span");
    tag.className = "scale-marker-label";
    tag.textContent = year;
    // Past the right-hand end the label would run off the figure, so it flips
    // to sit on the other side of its own line.
    if (pct > 80) tag.classList.add("is-left");

    // The reading itself, above the line, where it cannot be mistaken for one
    // of the band boundaries printed underneath.
    const value = document.createElement("span");
    value.className = "scale-marker-value";
    value.textContent = ordinal(pct);
    if (pct > 90) value.classList.add("is-left");
    if (pct < 10) value.classList.add("is-right");

    marker.append(value, tag);
    el.scaleBar.append(marker);
  }

  el.scaleBasis.textContent = fill(copy.home.scaleBasis,
                                   { threshold: magLabel(MIN_MAGNITUDE) });

  // Highest band at the top, so the list reads the way the question is asked:
  // "are there more?" first. The bar underneath still runs low to high left to
  // right, which is the only direction an axis can sensibly run.
  el.scaleRows.replaceChildren(...[...bands].reverse().map((b) => {
    const li = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = `scale-seg scale-${b.tint}`;
    swatch.style.opacity = String(b.fade);

    const range = document.createElement("span");
    range.className = "scale-range";
    range.textContent = fill(copy.home.scaleRow, { low: b.low, high: b.high });

    const said = document.createElement("span");
    said.className = "scale-said";
    said.innerHTML = b.text;

    const often = document.createElement("span");
    often.className = "scale-often";
    often.textContent = fill(copy.home.scaleFrequency, { n: b.width });

    if (pct !== null && pct >= b.low && pct <= b.high) li.className = "is-current";
    li.append(swatch, range, said, often);
    return li;
  }));

}

/* ---------------- highlight slots ---------------- */

function claimSlot(year: number) {
  if (state.highlights.has(year) || state.highlights.size >= MAX_HIGHLIGHTS) return;
  const taken = new Set(state.highlights.values());
  let slot = 0;
  while (taken.has(slot)) slot++;
  state.highlights.set(year, slot);
}

function toggleYear(year: number) {
  if (state.highlights.has(year)) state.highlights.delete(year);
  else claimSlot(year);
}

/* ---------------- controls ---------------- */

function buildSegmented(host: HTMLElement, options: { id: string; label: string }[],
                        selected: () => string, onPick: (id: string) => void) {
  host.replaceChildren();
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segmented-option";
    button.dataset.id = option.id;
    button.textContent = option.label;
    button.setAttribute("aria-pressed", String(option.id === selected()));
    button.addEventListener("click", () => {
      onPick(option.id);
      for (const sibling of host.querySelectorAll("button")) {
        sibling.setAttribute("aria-pressed", String(sibling === button));
      }
      void update();
    });
    host.append(button);
  }
}

function setPickerOpen(open: boolean) {
  el.yearPanel.hidden = !open;
  el.yearToggle.setAttribute("aria-expanded", String(open));
}

/**
 * Rebuilds the year list in place. Called on every render, so the colour dots
 * stay in step with the slots the chart is actually using.
 */
function buildYearPicker(years: number[], theme: ReturnType<typeof readTheme>) {
  const selected = [...state.highlights.keys()].sort((a, b) => b - a);
  const atCap = state.highlights.size >= MAX_HIGHLIGHTS;

  el.yearSummary.textContent = selected.length === 0
    ? copy.home.yearsNone
    : selected.length <= 3 ? selected.map((y) => yearLabel(y)).join(", ")
    : fill(copy.home.yearsSome, { n: selected.length });
  el.yearCount.textContent = fill(copy.home.yearsCount,
    { n: selected.length, max: MAX_HIGHLIGHTS });
  el.yearClear.disabled = selected.length === 0;

  // Keep a selected year's row even if it has no events, so it can be unchecked
  // rather than stranded as a checked-but-invisible year.
  const listed = [...new Set([...years, ...state.highlights.keys()])].sort((a, b) => b - a);

  el.yearList.replaceChildren();
  for (const year of listed) {
    const slot = state.highlights.get(year);
    const on = slot !== undefined;
    // At the cap, unchecked years are disabled rather than silently evicting an
    // existing selection -- a checkbox that quietly unchecks another one reads
    // as a bug.
    const disabled = !on && atCap;

    const row = document.createElement("label");
    row.className = `picker-row${disabled ? " is-disabled" : ""}`;

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = on;
    box.disabled = disabled;
    box.addEventListener("change", () => {
      toggleYear(year);
      void update();
    });

    row.append(box, document.createTextNode(yearLabel(year)));
    if (on) {
      const dot = document.createElement("i");
      dot.className = "dot";
      dot.style.background = theme.series[slot % theme.series.length];
      row.append(dot);
    }
    el.yearList.append(row);
  }
}

function wireYearPicker() {
  el.yearToggle.addEventListener("click", () => {
    setPickerOpen(el.yearPanel.hidden);
  });
  el.yearClear.addEventListener("click", () => {
    state.highlights.clear();
    void update();
  });
  document.addEventListener("click", (event) => {
    if (!el.yearPanel.hidden && !el.yearPicker.contains(event.target as Node)) {
      setPickerOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.yearPanel.hidden) {
      setPickerOpen(false);
      el.yearToggle.focus();
    }
  });
}

function buildControls() {
  buildSegmented(el.mag, MAGNITUDES.map((m) => ({ id: String(m), label: magLabel(m) })),
    () => String(state.minMag), (id) => { state.minMag = Number(id); });
  buildSegmented(el.range, RANGES.map((r) => ({ id: r.id, label: r.label })),
    () => state.range, (id) => { state.range = id as State["range"]; });
  buildSegmented(el.annualRange, ANNUAL_RANGES.map((r) => ({ id: r.id, label: r.label })),
    () => state.annualRange, (id) => { state.annualRange = id as State["annualRange"]; });
  buildSegmented(el.window, WINDOWS.map((w) => ({ id: w.id, label: w.label })),
    () => state.window, (id) => {
      state.window = id as State["window"];
      // "2025" means the calendar year in one mode and August-to-August in the
      // other. Carrying a selection across would quietly point it elsewhere.
      state.highlights.clear();
      claimSlot(dayIndex(Date.now(), calendarShift()).year);
    });
  buildSegmented(el.catalog, CATALOG_MODES.map((c) => ({ id: c.id, label: c.label })),
    () => state.catalogMode, (id) => { state.catalogMode = id as State["catalogMode"]; });
  wireYearPicker();
}

/* ---------------- live feed ---------------- */

/**
 * The realtime feeds are CORS-enabled and CDN-cached at 60s, so the browser can
 * poll them directly -- no proxy, and our traffic never touches the FDSN query
 * service. Anything older than the static build is already in the binary, so
 * filtering on time is enough to avoid double-counting.
 */
async function pollLive(afterMs: number) {
  try {
    const res = await fetch(LIVE_FEED, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const features = json.features ?? [];
    // USGS serves a short or empty summary while it regenerates one. Replacing
    // the list wholesale on such a response deleted the recent earthquakes from
    // the counts, the map and the largest list -- a 200 that says nothing is
    // not evidence that the earthquakes stopped. The non-OK and throw paths
    // already keep the previous array; this makes the successful-but-empty path
    // behave the same. A genuinely quiet day shrinks the feed gradually, not to
    // a fraction of what it held a minute ago.
    if (liveEvents.length && features.length < liveEvents.length / 2) return;
    liveEvents = features
      .filter((f: any) => f?.properties?.type === "earthquake"
        && typeof f.properties.mag === "number"
        && f.properties.time > afterMs)
      .map((f: any) => ({
        id: String(f.id ?? ""),
        time: f.properties.time,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        mag: f.properties.mag,
        place: String(f.properties.place ?? ""),
      }));
  } catch {
    // A failed poll is not worth surfacing: the static baseline is still correct.
  }
}

/**
 * Live events are counted in both catalog modes. They are too recent to have
 * been declustered, and treating them as dependent would make the current
 * year's count fall the moment the user switches to mainshocks -- so they are
 * presumed independent, matching how build.py treats unclassified events.
 */
function applyLive(curves: YearCurves, tier: Tier, minMag: number, shift: number,
                   measure: Measure): number {
  const cutoff = tier.info.lastTime ?? 0;
  let added = 0;
  for (const event of liveEvents) {
    if (event.mag < minMag || event.time <= cutoff) continue;
    const { year, day } = dayIndex(event.time, shift);
    // Created on demand. cumulativeByYear only makes a year's bucket once the
    // catalog holds an event in it, so on 1 January -- before the pipeline has
    // picked up the first one -- a live earthquake had no bucket and was
    // dropped from the counts, while the map and the largest-events list drew
    // it anyway. The page named an M7 and said none had occurred.
    let curve = curves.curves.get(year);
    if (!curve) {
      curve = new Float64Array(DAYS);
      curves.curves.set(year, curve);
      if (!curves.years.includes(year)) curves.years.push(year);
      curves.years.sort((a, b) => a - b);
    }
    // Whatever the curve is accumulating. cumulativeByYear adds seismicMoment
    // on the moment views, so adding 1 here made every live earthquake worth
    // the same as an M7.27 -- and moment supplies two of the six pooled tests,
    // so it reached the headline as well as the chart.
    const amount = measure === "moment" ? seismicMoment(event.mag) : 1;
    for (let d = day; d < DAYS; d++) curve[d] += amount;
    added++;
  }
  return added;
}

/**
 * This year on every way of counting it, not just the selected one.
 *
 * The controls above reach twelve combinations -- two magnitudes, aftershocks
 * in or out on the count views, count or moment, this year or the last 365
 * days -- and the percentile this year lands on differs widely across them.
 * The range is measured and quoted on the page. A reader who wants an unusual
 * year can find one by clicking, and a reader who does not know that will take
 * whichever slice happens to load as the whole story.
 *
 * The controls stay. The difference is what is being claimed. A section that
 * asserts something about the world -- that the rate is or is not changing --
 * cannot let the reader pick the series that best supports it; that is
 * p-hacking. This question is descriptive: how does this year compare, on the
 * measure you care about? Picking M7+ over M6+ is a legitimate interest, not a
 * fishing trip. So the fix is to show what the choice is worth rather than to
 * take it away.
 */
/**
 * One percentile. Deliberately carries no "is this the selected one" flag.
 *
 * The matching cell used to be picked out in the series colour. But the answer
 * above the table does not come from the selected combination -- that is the
 * whole point of pooling -- so colouring one of the twelve implied it was the
 * one that counted, and made the table look like it was answering the controls
 * when it is there to show what the controls are worth.
 */


/**
 * The aggregate answer to the page's own question.
 *
 * Every way of counting the year tests the same claim -- that this year is no
 * busier than usual -- so the six are pooled rather than corrected for. That is
 * a different job from the trend section's, where the question is whether ANY
 * of four series shows a trend once you have paid for looking four times, and
 * it wants a different tool: Westfall-Young there, Stouffer here.
 *
 * Stouffer needs the correlation between the tests, and these are close to the
 * same test six times over -- M6+ and M7+ moment correlate at 0.99, because
 * moment is dominated by the largest earthquakes either way -- so the six are
 * worth about 1.7 independent ones. See combineRanks.
 */

/**
 * The combined score of every year since 1976, with this one marked.
 *
 * The score, not the percentile it maps to. Percentiles are uniform by
 * construction -- fifty years spread five or six to a decile -- so a histogram
 * of them is a flat row of bars carrying no information but the marker. The
 * score behind them is a standard normal, so the same picture becomes a
 * distribution with a middle and two tails, and where this year sits in it is
 * legible at a glance.
 */




/**
 * Every number the technical summary quotes, collected as it is computed.
 *
 * The summary used to state them as text -- "the 41st to the 92nd percentile",
 * "25% where this says 21%" -- and they drifted from the code that produces
 * them: the copy said 41st while the comment beside the figure said 39th, and
 * both were written by hand at different times. They are interpolated now, so
 * a number on the page is the number the page computed.
 *
 * Filled as the page computes them, so a number in the summary is the number
 * the page drew. writeTech runs once they are all in.
 */
const techValues: Record<string, string | number> = {};

/**
 * The summary, with whatever numbers are known.
 *
 * A paragraph still holding an unresolved placeholder is dropped rather than
 * printed with braces in it. That only happens when the section that computes
 * the value bailed out -- too few years for a trend, say -- in which case the
 * paragraph describes something the page is not showing.
 */
function writeTech() {
  const body = fill(copy.home.techBody, techValues)
    .split("\n\n")
    .filter((para) => !/\{\w+\}/.test(para))
    .join("\n\n");
  renderTech(copy.home.techTitle, body, el.techTitle, el.techBody);
}


/**
 * Every past 365-day window as a histogram, with the current one marked.
 *
 * The same series the headline counts, so the bar the marker sits on is the
 * number printed beside it. It used to draw z-scores from a pooled score,
 * which is a quantity a reader cannot check against anything; counts they can.
 */
function writeHeadlineChart(curves: YearCurves, refYears: number[],
                            headline: ReturnType<typeof verdict>,
                            currentYear: number) {
  el.answerAggregate.replaceChildren();
  if (!headline || refYears.length < 3) return;

  const peers = refYears
    .map((year) => ({ year, value: curves.curves.get(year)![DAYS - 1] }))
    .filter((d) => Number.isFinite(d.value));
  if (peers.length < 3) return;

  const higher = peers.filter((d) => d.value > headline.count).length;
  const strip = renderDistribution({
    peers,
    value: headline.count,
    // A count of bars, not a share: the picture is bars, so the label should
    // describe the picture rather than a curve fitted through it.
    share: {
      more: fill(copy.home.headlineShareCount, { n: higher }),
      moreLabel: fill(copy.home.headlineShareMore, { peers: peers.length }),
    },
    currentLabel: yearLabel(currentYear),
    yearLabel: (year: number) => yearLabel(year, "rolling"),
    theme: readTheme(document.body),
    width: Math.max(260, el.answerAggregate.clientWidth || 340),
  });

  const caption = document.createElement("p");
  caption.className = "answer-caption";
  caption.textContent = fill(copy.home.headlineCaption, {
    threshold: magLabel(MIN_MAGNITUDE), from: REFERENCE_START,
  });
  el.answerAggregate.replaceChildren(strip, caption);
}

/* ---------------- event lookup ---------------- */




/* ---------------- largest events ---------------- */







/**
 * The most recent earthquake at the selected threshold.
 *
 * Reads the live feed first and falls back to the catalog, so it stays correct
 * in the window between an event happening and the next catalog rebuild -- and
 * because the feed is polled every minute, the line updates itself without a
 * reload.
 */
async function writeLatest(minMag: number) {
  const info = store.detailTierFor(minMag);
  let best: { time: number; mag: number; place: string } | null = null;

  for (const event of liveEvents) {
    if (event.mag < minMag) continue;
    if (!best || event.time > best.time) {
      best = { time: event.time, mag: event.mag, place: event.place };
    }
  }
  if (info) {
    try {
      const [tier, detail] = await Promise.all([store.load(info.threshold),
                                                store.loadDetail(info)]);
      for (let i = tier.n - 1; i >= 0; i--) {
        if (tier.mag[i] < minMag) continue;
        if (!best || tier.time[i] > best.time) {
          best = { time: tier.time[i], mag: tier.mag[i], place: detail.places[i] };
        }
        break;
      }
    } catch {
      // The line is a nicety; its absence should never break the page.
    }
  }
  if (!best) { el.latest.textContent = ""; return; }

  el.latest.textContent = fill(copy.home.latest, {
    threshold: magLabel(minMag),
    when: new Date(best.time).toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    }),
    mag: best.mag.toFixed(1),
    place: best.place || "",
  });
}

/**
 * Is the rate changing?
 *
 * Four fixed series, always all four: M6+ and M7+, each with aftershocks left
 * in and taken out. The toggles above do not touch this section, on purpose.
 * There are more than eight ways to slice this catalogue and their p-values run
 * from 0.07 to 0.85, so a reader handed the toggles will find the 0.07 and
 * stop. Showing the whole set and correcting for the number of looks is the
 * only honest way to put this question on a page anyone can click through.
 *
 * Counts only. Every moment series slopes up at about 25% per decade and all of
 * it is 2004, 2010 and 2011 landing in the second half of the record: a claim
 * about whether a great earthquake happened, not about the rate of earthquakes.
 *
 * Graded on the same three rungs as the correlations page, from the same kind
 * of p-value, and it never prints a bare slope. A slope invites "four percent a
 * decade, so twenty percent over fifty years" from a series whose fitted rise
 * is three quarters of one year's ordinary scatter.
 */
/** A percentage that always carries its sign, so a range across zero reads as one. */

/* One series. The other three -- M7+, and both thresholds with aftershocks
   left in -- are parked in attic/trend-multi-series, along with the
   multiplicity correction that four tests needed and one does not. */

/**
 * The permutation test is a hundred thousand shuffles, about 130ms. Every
 * resize re-renders, and the catalogue has not changed in between, so it is
 * held against a signature of the data rather than recomputed.
 */




/**
 * Whole-year totals for one series, on the calendar, ignoring every toggle.
 *
 * Deliberately not derived from the annual chart's numbers: those follow the
 * measure, the magnitude, the decluster switch and the rolling-window shift,
 * which is exactly the dependence this section exists to remove.
 */


/** The fitted line and its 95% band, as marks. */

/* ---------------- render ---------------- */

let lastRender: (() => void) | null = null;

async function update() {
  const minMag = state.minMag;

  let tier: Tier;
  try {
    tier = await store.load(minMag);
  } catch (err) {
    el.chart.replaceChildren(errorBox(fill(copy.home.errorCatalog,
      { message: (err as Error).message })));
    return;
  }

  // Counted by the pipeline and carried in meta.json, so the figure the page
  // quotes is the one the catalogue actually has. See build.py, which prints
  // the same ratio when it emits the tier.
  const base = store.tierFor(MIN_MAGNITUDE);
  techValues.mwShare = base.count
    ? (100 * base.homogenised / base.count).toFixed(1) : "0";
  techValues.threshold = magLabel(MIN_MAGNITUDE);
  techValues.from = REFERENCE_START;
  techValues.major = magLabel(MAJOR_MAGNITUDE);

  const shift = calendarShift();
  const { year: currentYear, day: dayOfYear } = dayIndex(Date.now(), shift);
  // A rolling window always ends today, so it is complete: the current "year"
  // runs the full 365 days and is compared only against equally complete ones.
  // A calendar year is part-way through, and is compared against the same date
  // in every past year.
  const rolling = state.window === "rolling";
  const today = rolling ? DAYS - 1 : dayOfYear;

  const mainshocksOnly = effectiveMainshocksOnly();
  const curves = cumulativeByYear(
    tier, minMag, REFERENCE_START, mainshocksOnly, state.measure, shift);
  const splitMajor = minMag < MAJOR_MAGNITUDE;
  const majorCurves = splitMajor
    ? cumulativeByYear(
        tier, MAJOR_MAGNITUDE, REFERENCE_START, mainshocksOnly, state.measure, shift)
    : { curves: new Map<number, Float64Array>(), years: [], matched: 0 };
  const liveAdded = applyLive(curves, tier, minMag, shift, state.measure);

  const refYears = curves.years.filter((y) => y >= REFERENCE_START && y < currentYear);
  const percentiles = empiricalBand(curves, refYears, state.measure);
  techValues.years = refYears.length;
  // The sigma view takes its spread from every window in the record, not from
  // the calendar years -- see rollingWindowBand. The percentile view stays as
  // it is: percentiles are robust to a single huge event, so it has no step to
  // remove and "what previous years did" is a claim about years.
  const windows = state.range === "sigma" || state.annualRange === "sigma"
    ? rollingWindowBand(tier, minMag, mainshocksOnly, state.measure, REFERENCE_START)
    : null;
  const band = windows && state.range === "sigma"
    ? windows.map((r, i) => ({ ...percentiles[i], mean: r.mean, sdLo: r.sdLo, sdHi: r.sdHi }))
    : percentiles;
  // A full year's worth is the last window length, so both charts show the same
  // band rather than two different measurements of the same quantity.
  const annualSigma = windows && state.annualRange === "sigma"
    ? { lo: windows[windows.length - 1].sdLo, hi: windows[windows.length - 1].sdHi }
    : null;
  const result = verdict(curves, refYears, currentYear, today, state.measure);

  // The annual chart carries its own window, so it needs its own curves rather
  // than a slice of the ones the cumulative chart is drawn from.
  const annualShift = calendarShift(state.annualWindow);
  const annualRolling = state.annualWindow === "rolling";
  const sameWindow = state.annualWindow === state.window;
  const annualCurvesFor = (threshold: number) => {
    const c = cumulativeByYear(
      tier, threshold, REFERENCE_START, mainshocksOnly, state.measure, annualShift);
    applyLive(c, tier, threshold, annualShift, state.measure);
    return c;
  };
  const aCurves = sameWindow ? curves : annualCurvesFor(minMag);
  const aMajor = !splitMajor ? majorCurves
               : sameWindow ? majorCurves : annualCurvesFor(MAJOR_MAGNITUDE);
  const { year: aYear, day: aDay } = dayIndex(Date.now(), annualShift);
  const aToday = annualRolling ? DAYS - 1 : aDay;
  const aRefYears = aCurves.years.filter((y) => y >= REFERENCE_START && y < aYear);
  const counts = annualCounts(aCurves, aMajor, aYear, aToday, aRefYears,
                             state.measure);
  const kind = effectiveMainshocksOnly() ? "mainshocks" : "earthquakes";
  const subject = state.measure === "moment"
    ? fill(copy.home.cumulativeSubjectMoment, { threshold: magLabel(minMag) })
    : fill(copy.home.cumulativeSubjectCount, { threshold: magLabel(minMag), kind });

  // The one reading the controls cannot move: M6+, all earthquakes, counted,
  // over the same 365-day window. Always the M6 tier, whatever is selected
  // above -- with M7+ chosen, the selected tier holds only M7+ events, and
  // computing "M6+" from it would silently answer a different question.
  let headlineTier = tier;
  if (minMag !== MIN_MAGNITUDE) {
    try {
      headlineTier = await store.load(MIN_MAGNITUDE);
    } catch {
      headlineTier = tier;
    }
  }
  const headlineCurves = cumulativeByYear(
    headlineTier, MIN_MAGNITUDE, REFERENCE_START, false, "count", shift);
  applyLive(headlineCurves, headlineTier, MIN_MAGNITUDE, shift, "count");
  const headlineRef = headlineCurves.years.filter(
    (y) => y >= REFERENCE_START && y < currentYear);
  const headline = verdict(headlineCurves, headlineRef, currentYear, today, "count");
  const headlinePct = headline ? headline.percentile * 100 : null;

  writeHeadline(result, currentYear, headlinePct);
  writeHeadlineChart(headlineCurves, headlineRef, headline, currentYear);
  void writeLatest(minMag);
  buildAnswerScale(headlinePct, yearLabel(currentYear));
  writeNote(refYears.length, liveAdded);
  writeAnnualNote(aYear, splitMajor, annualRolling);

  el.chartTitle.textContent = fill(copy.home.cumulativeTitle, {
    subject, from: REFERENCE_START, to: currentYear - 1,
  });
  el.annualTitle.textContent = state.measure === "moment"
    ? copy.home.annualTitleMoment
    : fill(copy.home.annualTitleCount, { threshold: magLabel(minMag), kind });

  lastRender = () => {
    const theme = readTheme(document.body);
    buildYearPicker(curves.years, theme);

    if (band.length === 0 || refYears.length === 0) {
      el.chart.replaceChildren(errorBox(copy.home.errorNoHistory));
      return;
    }

    const highlights: Highlight[] = [...state.highlights.entries()]
      .filter(([year]) => curves.curves.has(year))
      .sort((a, b) => a[1] - b[1])
      .map(([year, slot]) => ({
        year,
        label: yearLabel(year),
        color: theme.series[slot % theme.series.length],
        through: year === currentYear ? today : DAYS - 1,
      }));

    // The annual chart runs on its own window, so "the current year" is a
    // different number there: with the cumulative chart on a rolling window the
    // year in progress is 2025, while the calendar chart beside it is drawing
    // 2026. Highlighting by number alone put the blue bar one to the left.
    const annualHighlights: Highlight[] = sameWindow ? highlights
      : [...state.highlights.entries()]
          .sort((a, b) => a[1] - b[1])
          .map(([year, slot]) => {
            const own = year === currentYear ? aYear : year;
            return {
              year: own,
              label: yearLabel(own, state.annualWindow),
              color: theme.series[slot % theme.series.length],
              through: own === aYear ? aToday : DAYS - 1,
            };
          })
          .filter((h) => aCurves.curves.has(h.year));

    // Day 0 of the window is 1 January only in the calendar view; the rolling
    // view starts it on today's date, so the axis has to be told.
    const dayToDate = (day: number) => {
      const start = Date.UTC(currentYear, 0, 1) + shift;
      const end = Date.UTC(currentYear + 1, 0, 1) + shift;
      return new Date(start + (day / DAYS) * (end - start));
    };

    // Each figure measures its own container. This used to measure #chart for
    // all of them, which was fine while that was the first chart on the page;
    // it now sits inside "Explore the data" at the foot, and the sections above
    // were being drawn to whatever width it happened to report.
    const widthOf = (node: HTMLElement) => Math.max(320, node.clientWidth || 800);
    const width = widthOf(el.chart);

    if (result) {
      const peers = refYears
        .map((year) => ({ year, value: curves.curves.get(year)?.[today] ?? NaN }))
        .filter((d) => Number.isFinite(d.value));
      const above = Math.round(result.aboveShare * 100);
      const moment = state.measure === "moment";
      const stripWidth = Math.max(240, el.answerDetail.clientWidth || 340);
      // Moment is plotted as the magnitude of the single earthquake that would
      // release it. Raw moment runs from 6 to 592 x10^20 N.m -- 2011 alone is 26
      // times the median -- so the bars pile into one bin and the axis carries a
      // unit nobody reads. The log turn makes it a 1.3-magnitude spread, and it
      // is the number the answer sentence already quotes.
      const asMagnitude = (v: number) => equivalentMagnitude(v);
      const peerValues = moment
        ? peers.map((d) => ({ ...d, value: asMagnitude(d.value) }))
        : peers;
      const strip = renderDistribution({
        peers: peerValues,
        yearLabel: (year: number) => yearLabel(year),
        value: moment ? asMagnitude(result.count) : result.count,
        share: {
          more: fill(copy.home.stripShare, { share: above }),
          moreLabel: fill(
            moment ? copy.home.stripShareMoreMoment : copy.home.stripShareMore,
            {
              subject: `${magLabel(minMag)} ${kind}`,
              // A full twelve months, so there is no "as of" date to give.
              when: "",
            }),
        },
        currentLabel: moment
          ? fill(copy.home.stripCurrentMoment, {
              year: yearLabel(currentYear), count: asMagnitude(result.count).toFixed(1),
            })
          : fill(copy.home.stripCurrent, {
              year: yearLabel(currentYear), count: fmt(result.count),
            }),
        tickFormat: moment ? (n: number) => `M${n.toFixed(1)}` : undefined,
        // Tucked into the corner of the chart, so it gives up its caption and
        // a third of its height. What it is showing is named by the controls
        // directly above it.
        compact: true,
        theme, width: stripWidth,
      });
      el.answerDetail.replaceChildren(strip);
    }
    const figure = renderChart({
      curves, band, refYears, highlights, today, theme, width, dayToDate,
      yLabel: state.measure === "moment"
        ? copy.home.axisCumulativeMoment
        : fill(copy.home.axisCumulativeCount, { threshold: magLabel(minMag) }),
      wholeNumbers: state.measure === "count",
      bandMode: state.range,
      yMax: Math.max(0, ...band.map((b) => b.hi), ...band.map((b) => b.sdHi),
                     ...highlights.map((h) => curves.curves.get(h.year)?.[h.through] ?? 0)),
    });
    el.chart.replaceChildren(figure);
    figure.after(buildLegend(theme, highlights, REFERENCE_START, currentYear - 1));

    el.annualChart.replaceChildren(renderAnnualChart({
      counts, highlights: annualHighlights, refYears: aRefYears,
      theme, width: widthOf(el.annualChart),
      yearLabel: (year: number) => yearLabel(year, state.annualWindow),
      yLabel: state.measure === "moment"
        ? copy.home.axisAnnualMoment
        : fill(copy.home.axisAnnualCount, { threshold: magLabel(minMag) }),
      wholeNumbers: state.measure === "count",
      sigma: annualSigma,
      yMax: Math.max(0, ...counts.map((c) => Math.max(c.count, c.projected))),
    }));

      writeTech();

  };
  lastRender();
}

function buildLegend(theme: ReturnType<typeof readTheme>, highlights: Highlight[],
                     from: number, to: number): HTMLElement {
  const wrap = document.createElement("p");
  wrap.className = "legend";
  // Each swatch is drawn in the style of the mark it stands for. Flat bars for
  // everything made the reference median -- a thin dashed line on the chart --
  // look identical to a highlighted year's solid accent, and identical again to
  // the faint past years, which share its colour.
  type Kind = "accent" | "faint" | "dashed" | "band";
  const entries: { color: string; label: string; kind: Kind }[] = [
    ...highlights.map((h) => ({ color: h.color, label: yearLabel(h.year), kind: "accent" as Kind })),
    { color: theme.history, label: fill(copy.home.legendOtherYears, { from, to }), kind: "faint" },
    { color: theme.median,
      label: state.range === "sigma" ? copy.home.legendMean : copy.home.legendMedian,
      kind: "accent" },
    ...(state.range === "sigma"
      ? [{ color: theme.rangeInner, label: copy.home.legendSigma, kind: "band" as Kind }]
      : [{ color: theme.rangeInner, label: copy.home.legendBandInner, kind: "band" as Kind },
         { color: theme.rangeOuter, label: copy.home.legendBand, kind: "band" as Kind }]),
  ];
  for (const { color, label, kind } of entries) {
    const span = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = `swatch-${kind}`;
    if (kind === "dashed") {
      swatch.style.backgroundImage =
        `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 7px)`;
    } else {
      swatch.style.background = color;
    }
    span.append(swatch, document.createTextNode(label));
    wrap.append(span);
  }
  return wrap;
}

/**
 * Answers only what the chart below it shows: where this year sits against the
 * years before it. Nothing here depends on a long-run trend -- a trend cannot
 * change between visits, and cannot be checked by eye against the chart, so it
 * belongs beside the annual chart instead.
 */
/**
 * The answer at the top of the page.
 *
 * The sentence is read off the pooled percentile, not off whichever way of
 * counting the controls happen to be set to. Those move it from the 41st to the
 * 92nd, which meant the page's own answer could be changed by clicking; the
 * pooled figure is what the question deserves, and it does not move. What the
 * controls still change is everything below the sentence -- the histogram
 * beside it, the charts, the table -- all of which say which setting they are
 * showing.
 */
function writeHeadline(result: ReturnType<typeof verdict>, currentYear: number,
                       headlinePct: number | null) {
  const kind = effectiveMainshocksOnly() ? "mainshocks" : "earthquakes";
  const moment = state.measure === "moment";

  if (!result || result.count === 0) {
    el.answer.innerHTML = copy.home.answerNothingYet;
    el.answerDetail.replaceChildren();
    el.answerSummary.textContent = moment
      ? fill(copy.home.detailNoneMoment, { year: yearLabel(currentYear) })
      : fill(copy.home.detailNoneCount,
             { threshold: magLabel(state.minMag), kind, year: yearLabel(currentYear) });
    return;
  }

  el.answer.innerHTML = fill(answerFor(headlinePct ?? result.percentile * 100, true),
                             { year: yearLabel(currentYear), from: REFERENCE_START });

  const shared = {
    from: REFERENCE_START, to: currentYear - 1,
    above: Math.round(result.aboveShare * 100),
  };
  el.answerSummary.textContent = moment
    ? fill(copy.home.detailMomentRolling, {
        ...shared, count: withUnit(result.count),
        equivalent: equivalentMagnitude(result.count).toFixed(1),
        median: withUnit(result.medianToDate),
      })
    : fill(copy.home.detailCountRolling, {
        ...shared, count: fmt(result.count), threshold: magLabel(state.minMag), kind,
        median: fmt(result.medianToDate),
      });
}

function writeNote(refCount: number, liveAdded: number) {
  const notes: string[] = [
    state.range === "sigma"
      ? fill(copy.home.noteSigma, { years: refCount })
      : fill(copy.home.noteBand, { years: refCount }),
  ];

  if (state.measure === "moment") notes.push(copy.home.noteMoment);

  if (effectiveMainshocksOnly()) {
    notes.push(copy.home.noteMainshocks);
    if (liveAdded > 0) {
      notes.push(fill(copy.home.noteLiveUnclassified, {
        n: liveAdded, s: liveAdded === 1 ? "" : "s", is: liveAdded === 1 ? "is" : "are",
      }));
    }
  }

  el.chartNote.textContent = notes.join(" ");
}

/**
 * Notes for the annual chart.
 *
 * No trend line and no slope. Fitted across a window reaching back to the
 * 1970s, the number is dominated by how the catalogue was built rather than by
 * seismicity, and it would read as a finding.
 */
function writeAnnualNote(currentYear: number, splitMajor: boolean, rolling: boolean) {
  const template = rolling
    ? (splitMajor ? copy.home.noteAnnualRollingMajor : copy.home.noteAnnualRolling)
    : (splitMajor ? copy.home.noteAnnual : copy.home.noteAnnualPlain);
  el.annualNote.textContent = fill(template,
    { major: magLabel(MAJOR_MAGNITUDE),
      year: yearLabel(currentYear, state.annualWindow) });
}

function errorBox(message: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "error";
  box.textContent = message;
  return box;
}

/* ---------------- boot ---------------- */

let resizeTimer: number | undefined;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => lastRender?.(), 150);
});
/** The last event time across all tiers, which is where the live feed takes over. */
function newestTime(): number {
  return Math.max(...meta.tiers.map((t) => t.lastTime ?? 0));
}

/**
 * Pick up a rebuilt catalog without a page reload.
 *
 * The pipeline republishes every fifteen minutes, but a tab that stayed open
 * kept whatever it loaded at first paint. That was not merely stale: the live
 * feed only reaches back a day, so once an event aged out of it, a tab whose
 * catalog predated that event dropped it from the page entirely. Counts went
 * down while you watched.
 *
 * meta.json is 4 KB and carries a build timestamp, so the check is cheap and
 * the tiers are only refetched when there is something new to fetch.
 */
async function refreshCatalog() {
  try {
    const fresh = await loadMeta();
    if (fresh.generated === meta.generated) return;
    meta = fresh;
    store = new CatalogStore(meta);
    el.generated.textContent = fill(copy.home.generated,
      { when: new Date(meta.generated).toUTCString() });
    // Re-checked against the new catalog. checkCatalog ran once at boot, so a
    // tab left open through a bad rebuild kept drawing it unwarned -- and a
    // banner raised for a bad catalog never cleared once a good one replaced
    // it. Both directions now follow the catalog on the page.
    document.querySelector("main > .integrity")?.remove();
    const problem = checkCatalog(meta);
    if (problem) showProblem(problem);
  } catch {
    // Keep serving what we have; the next tick tries again.
  }
}

async function boot() {
  try {
    meta = await loadMeta();
  } catch (err) {
    el.answer.textContent = "Could not load the catalogue.";
    el.answerDetail.textContent = fill(copy.home.errorBoot,
      { message: (err as Error).message });
    return;
  }

  const problem = checkCatalog(meta);
  if (problem) showProblem(problem);

  store = new CatalogStore(meta);
  buildControls();
  // Seeded once, not per render, so "Clear all" leaves the chart showing just
  // the reference backdrop instead of snapping the current year back on.
  claimSlot(dayIndex(Date.now(), calendarShift()).year);

  if (!meta.declustered) {
    const control = el.catalog.closest("fieldset");
    if (control) control.hidden = true;
  }

  el.generated.textContent = fill(copy.home.generated,
    { when: new Date(meta.generated).toUTCString() });

  await pollLive(newestTime());
  await update();

  window.setInterval(async () => {
    await refreshCatalog();
    await pollLive(newestTime());
    await update();
  }, LIVE_INTERVAL_MS);
}

startAnalytics();
installHintGuard();
void boot();
