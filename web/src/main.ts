import { CatalogStore, DATA_BASE, loadMeta, type Meta, type Tier } from "./catalog";
import { renderAnnualChart, renderChart, renderDistribution, renderTrend,
         readTheme, type Highlight, type Theme } from "./chart";
import {
  DAYS, MAGNITUDES, MAJOR_MAGNITUDE, MIN_MAGNITUDE, annualCounts, cumulativeByYear,
  TREND_PERMUTATIONS, combineRanks, combinedTrendP, dayIndex, empiricalBand,
  equivalentMagnitude,
  rollingWindowBand,
  trend, verdict,
  type Combined, type Measure, type Trend, type YearCurves,
} from "./stats";
import { loadLand, renderMap, type MapEvent } from "./map";
import { copy, fill } from "./copy";
import { renderTech } from "./tech";
import { flipTable } from "./verdict";
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

const CATALOG_MODES = [
  { id: "all", label: "All earthquakes" },
  { id: "mainshocks", label: "Mainshocks only" },
] as const;
const MEASURES = [
  { id: "count", label: "Count" },
  { id: "moment", label: "Moment" },
] as const;
const WINDOWS = [
  { id: "calendar", label: "This year" },
  { id: "rolling", label: "Last 365 days" },
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
const SORT_MODES = [
  { id: "largest", label: "Largest" },
  { id: "recent", label: "Recent" },
] as const;

/** The panel scrolls, so this only needs to be past any plausible year's count. */
const EVENT_LIST_LIMIT = 250;

/** Colour slots available to highlighted years; index 0 is the current year. */
const MAX_HIGHLIGHTS = 5;

const LIVE_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const LIVE_INTERVAL_MS = 60_000;

interface State {
  minMag: number;
  window: (typeof WINDOWS)[number]["id"];
  measure: Measure;
  sortMode: (typeof SORT_MODES)[number]["id"];
  range: (typeof RANGES)[number]["id"];
  annualRange: (typeof ANNUAL_RANGES)[number]["id"];
  catalogMode: (typeof CATALOG_MODES)[number]["id"];
  /** Year -> colour slot. Slots are held until a year is deselected, so
      removing one highlight never repaints the others. */
  highlights: Map<number, number>;
}

const state: State = {
  minMag: MIN_MAGNITUDE,
  window: "calendar",
  measure: "count",
  sortMode: "largest",
  range: "percentile",
  annualRange: "off",
  catalogMode: "all",
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
function yearLabel(year: number): string {
  return state.window === "calendar"
    ? String(year)
    : `${year}–${String(year + 1).slice(2)}`;
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
  answerDetail: document.getElementById("answer-detail")!,
  answerSummary: document.getElementById("answer-summary")!,
  latest: document.getElementById("latest")!,
  measure: document.getElementById("measure-control")!,
  mag: document.getElementById("mag-control")!,
  window: document.getElementById("window-control")!,
  catalogField: document.getElementById("catalog-field") as HTMLFieldSetElement,
  sort: document.getElementById("sort-control")!,
  catalog: document.getElementById("catalog-control")!,
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
  map: document.getElementById("map")!,
  mapTitle: document.getElementById("map-title")!,
  mapLegend: document.getElementById("map-legend")!,
  largestHeading: document.getElementById("largest-heading")!,
  range: document.getElementById("range-control")!,
  annualRange: document.getElementById("annual-range-control")!,
  scaleTitle: document.getElementById("scale-title")!,
  scaleBar: document.getElementById("scale-bar")!,
  scaleRows: document.getElementById("scale-rows")!,
  scaleNote: document.getElementById("scale-note")!,
  largestList: document.getElementById("largest-list")!,
  largestNote: document.getElementById("largest-note")!,
  generated: document.getElementById("generated")!,
  trendQuestion: document.getElementById("trend-question")!,
  trendVerdict: document.getElementById("trend-verdict")!,
  trendBody: document.getElementById("trend-body")!,
  spread: document.getElementById("spread") as HTMLElement,
  answerAggregate: document.getElementById("answer-aggregate")!,
  spreadAggregate: document.getElementById("spread-aggregate")!,
  spreadChart: document.getElementById("spread-chart")!,
  spreadNote: document.getElementById("spread-note")!,
  trendTable: document.getElementById("trend-table")!,
  trendGrid: document.getElementById("trend-grid")!,
  trendOverlap: document.getElementById("trend-overlap")!,
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
      // false, not the window setting: these are the sentences the headline can
      // print, and it prints the calendar ones.
      text: fill(answerFor((low + high) / 2, false), { year, from: REFERENCE_START }),
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

    marker.append(tag);
    el.scaleBar.append(marker);
  }

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

  el.scaleNote.textContent = pct === null ? "" : fill(copy.home.scaleNote, {
    year, percentile: ordinal(pct),
  });
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
    : selected.length <= 3 ? selected.map(yearLabel).join(", ")
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

/**
 * Greys out the controls moment mode ignores -- and, importantly, repoints
 * their highlight at what is actually being used.
 *
 * Disabling alone is not enough: a greyed control still showing "M6+" reads as
 * "moment is being summed over M6+", which would be false. In moment mode the
 * highlight moves to M4.5+ and "All earthquakes", which is the truth, and moves
 * back to the reader's own choice when they return to counts.
 */
function syncControlAvailability() {
  const off = state.measure === "moment";
  el.catalogField.classList.toggle("is-off", off);
  for (const button of el.catalog.querySelectorAll<HTMLButtonElement>("button.segmented-option")) {
    button.disabled = off;
    button.setAttribute("aria-pressed",
      String(button.dataset.id === (off ? "all" : state.catalogMode)));
  }
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
  buildSegmented(el.measure, MEASURES.map((m) => ({ id: m.id, label: m.label })),
    () => state.measure, (id) => {
      state.measure = id as Measure;
      syncControlAvailability();
    });
  buildSegmented(el.catalog, CATALOG_MODES.map((c) => ({ id: c.id, label: c.label })),
    () => state.catalogMode, (id) => { state.catalogMode = id as State["catalogMode"]; });
  buildSegmented(el.sort, SORT_MODES.map((s) => ({ id: s.id, label: s.label })),
    () => state.sortMode, (id) => { state.sortMode = id as State["sortMode"]; });
  wireYearPicker();
  syncControlAvailability();
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
    liveEvents = (json.features ?? [])
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
function applyLive(curves: YearCurves, tier: Tier, minMag: number, shift: number): number {
  const cutoff = tier.info.lastTime ?? 0;
  let added = 0;
  for (const event of liveEvents) {
    if (event.mag < minMag || event.time <= cutoff) continue;
    const { year, day } = dayIndex(event.time, shift);
    const curve = curves.curves.get(year);
    if (!curve) continue;
    for (let d = day; d < DAYS; d++) curve[d] += 1;
    added++;
  }
  return added;
}

/**
 * This year on every way of counting it, not just the selected one.
 *
 * The controls above reach twelve combinations -- two magnitudes, aftershocks
 * in or out on the count views, count or moment, this year or the last 365
 * days -- and this year currently lands anywhere from the 39th percentile to
 * the 92nd across them. A reader who wants an unusual year can find one by
 * clicking, and a reader who does not know that will take whichever slice
 * happens to load as the whole story.
 *
 * The controls stay, unlike on the trend section, where the four series were
 * fixed. The difference is what is being claimed. The trend section asserts
 * something about the world -- that the rate is or is not changing -- and
 * letting the reader pick the series that best supports it is p-hacking. This
 * question is descriptive: how does this year compare, on the measure you care
 * about? Picking M7+ over M6+ is a legitimate interest, not a fishing trip. So
 * the fix is to show what the choice is worth rather than to take it away.
 */
interface SpreadCell {
  percentile: number;
  selected: boolean;
}

/** One row per way of counting; one cell per time window. */
interface SpreadRow {
  label: string;
  cells: SpreadCell[];
}

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
/** Each value's rank among the others, itself excluded, ties counted as half. */
function leaveOneOutPercentiles(values: number[]): number[] {
  return values.map((v, i) => {
    let below = 0, tied = 0;
    values.forEach((o, j) => {
      if (j === i) return;
      if (o < v) below++;
      else if (o === v) tied++;
    });
    return (100 * (below + tied / 2)) / Math.max(1, values.length - 1);
  });
}

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
function writeAggregateChart(spread: ReturnType<typeof spreadTable>,
                             currentYear: number) {
  const a = spread.aggregate;
  if (!a || a.scores.length < 3) { el.answerAggregate.replaceChildren(); return; }

  const theme = readTheme(document.body);
  const width = Math.max(260, el.answerAggregate.clientWidth || 340);
  const scores = a.scores;
  const first = currentYear - (scores.length - 1);
  const peers = scores.slice(0, -1).map((value, i) => ({ year: first + i, value }));
  const above = Math.round(100 * a.p);

  const strip = renderDistribution({
    peers,
    value: a.z,
    share: {
      more: fill(copy.home.stripShare, { share: above }),
      moreLabel: copy.home.aggregateShareMore,
    },
    // Just the year. The percentile was on the marker as well as in the
    // sentence above the chart, which printed the same number twice.
    currentLabel: fill(copy.home.aggregateCurrent, { year: yearLabel(currentYear) }),
    theme, width,
  });

  const caption = document.createElement("p");
  caption.className = "answer-caption";
  caption.append(
    fill(copy.home.aggregateCaption, { from: first, ways: a.tests }),
    " ",
    hint(copy.home.aggregateHelp, fill(copy.home.aggregateHelpBody, {
      ways: a.tests, year: yearLabel(currentYear), z: a.z.toFixed(2),
    })),
  );
  el.answerAggregate.replaceChildren(strip, caption);
}

/** "58th, 60th, 68th, 82nd and 92nd". */
function listOf(parts: string[]): string {
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The page's question-mark tooltip, built as nodes rather than markup. */
function hint(label: string, body: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "hint";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hint-button";
  button.setAttribute("aria-label", label);
  button.textContent = "?";
  const tip = document.createElement("span");
  tip.className = "hint-tip";
  tip.setAttribute("role", "tooltip");
  // One <p> per paragraph. The tips written into the HTML use <br /><br />,
  // and .hint-tip has no white-space rule, so a body assigned with textContent
  // collapsed its blank lines and came out as one block of prose.
  for (const para of body.split("\n\n")) {
    const line = document.createElement("p");
    line.textContent = para;
    tip.append(line);
  }
  wrap.append(button, tip);

  // The tip is centred on the "?" in CSS, which is right for a caption in the
  // middle of the page. It is not enough on its own: a "?" close to either
  // margin still puts half a 22rem box past the edge. So on open, measure and
  // shift it back inside. Measuring happens in rAF because the tip is
  // display:none until :hover matches, and a rect taken too early is all zeros.
  const place = () => {
    tip.style.setProperty("--hint-nudge", "0px");
    requestAnimationFrame(() => {
      const r = tip.getBoundingClientRect();
      if (!r.width) return;
      const margin = 8;
      const over = r.right - (window.innerWidth - margin);
      const under = margin - r.left;
      const dx = over > 0 ? -over : under > 0 ? under : 0;
      if (dx) tip.style.setProperty("--hint-nudge", `${Math.round(dx)}px`);
    });
  };
  wrap.addEventListener("mouseenter", place);
  wrap.addEventListener("focusin", place);

  return wrap;
}

const SPREAD_WINDOWS: State["window"][] = ["calendar", "rolling"];

function spreadTable(tier: Tier): { rows: SpreadRow[]; aggregate: Combined | null;
                                    years: number } {
  const rows: SpreadRow[] = [];
  // One year -> percentile map per slicing. Keyed by year rather than indexed
  // by position: the rolling window shifts the year boundary, so its year list
  // is not the same length as the calendar one, and an earlier version quietly
  // dropped every rolling slicing on a length check -- averaging six where the
  // text beside it said twelve.
  const ranks: Map<number, number>[] = [];

  for (const minMag of MAGNITUDES) {
    for (const measure of ["count", "moment"] as Measure[]) {
      // Declustering is only offered on the count views, so the moment ones
      // have no aftershock choice to enumerate. Mirroring what the controls
      // can actually reach matters: a table listing combinations the page
      // cannot produce would not be a summary of this page.
      for (const mainshocksOnly of measure === "count" ? [false, true] : [false]) {
        const cells: SpreadCell[] = [];
        for (const window of SPREAD_WINDOWS) {
          const shift = calendarShift(window);
          const curves = cumulativeByYear(
            tier, minMag, REFERENCE_START, mainshocksOnly, measure, shift);
          applyLive(curves, tier, minMag, shift);
          const { year, day: today } = dayIndex(Date.now(), shift);
          const day = window === "rolling" ? DAYS - 1 : today;
          const refYears = curves.years.filter((y) => y >= REFERENCE_START && y < year);
          const result = verdict(curves, refYears, year, day, measure);
          if (!result) continue;

          // Calendar slicings only. A shifted window labels the 365 days
          // ending today as year 2025, because that is where its year boundary
          // falls, while a calendar slicing means by 2025 the whole of last
          // year. Averaging the two puts this year's rolling total next to last
          // year's completed one under the same label. Rolling stays in the
          // table, where each column is read on its own terms; it is left out
          // of the average, which has to compare like with like.
          if (window === "calendar") {
            const scored = curves.years.filter((y) => y >= REFERENCE_START && y <= year);
            const percentiles = leaveOneOutPercentiles(
              scored.map((y) => curves.curves.get(y)![day]));
            ranks.push(new Map(scored.map((y, i) => [y, percentiles[i]])));
          }

          cells.push({
            percentile: result.percentile * 100,
            selected: minMag === state.minMag && measure === state.measure
                   && mainshocksOnly === effectiveMainshocksOnly()
                   && window === state.window,
          });
        }
        if (cells.length !== SPREAD_WINDOWS.length) continue;
        rows.push({
          label: fill(copy.home.spreadLabel, {
            threshold: magLabel(minMag),
            catalog: mainshocksOnly ? copy.home.spreadMainshocks : copy.home.spreadAll,
            measure: measure === "moment" ? copy.home.spreadMoment : copy.home.spreadCount,
          }),
          cells,
        });
      }
    }
  }

  // Only years every slicing scored, so the correlation between the tests is
  // measured over one common set of years.
  const shared = ranks.length
    ? [...ranks[0].keys()].filter((y) => ranks.every((r) => r.has(y))).sort((a, b) => a - b)
    : [];
  const aggregate = shared.length > 2
    ? combineRanks(ranks.map((r) => shared.map((y) => r.get(y)!)))
    : null;
  return { rows, aggregate, years: shared.length - 1 };
}

function writeSpread(spread: ReturnType<typeof spreadTable>, currentYear: number) {
  const { rows, aggregate } = spread;
  if (rows.length < 2) { el.spread.hidden = true; return; }
  el.spread.hidden = false;

  const c = copy.home;
  const all = rows.flatMap((r) => r.cells.map((cell) => cell.percentile));
  el.spreadNote.textContent = fill(c.spreadNote, {
    ways: all.length,
    low: ordinal(Math.min(...all)),
    high: ordinal(Math.max(...all)),
  });
  el.spreadAggregate.replaceChildren();
  if (aggregate) {
    const pct = (v: number) => (v >= 0.1 ? (100 * v).toFixed(0) : (100 * v).toFixed(1));
    el.spreadAggregate.append(fill(c.spreadAggregate, {
      year: yearLabel(currentYear),
      percentile: ordinal(100 * (1 - aggregate.p)),
      p: pct(aggregate.p),
    }), " ", hint(c.spreadHelp, fill(c.spreadHelpBody, {
      ways: aggregate.tests, year: yearLabel(currentYear),
      ranks: listOf(aggregate.each.map((v) => `${pct(v)}%`)),
      effective: aggregate.effective.toFixed(1),
      z: aggregate.z.toFixed(2), p: pct(aggregate.p),
    })));
  }

  writeAggregateChart(spread, currentYear);

  const box = document.createElement("div");
  box.className = "correlate-flip spread-box";
  const list = document.createElement("ol");
  list.className = "flip-rows";
  const template = "minmax(0, 1fr) minmax(0, 7.5rem) minmax(0, 7.5rem)";

  const row = (cells: string[], cls: string, marked: boolean[] = []) => {
    const li = document.createElement("li");
    li.className = cls;
    li.style.gridTemplateColumns = template;
    cells.forEach((text, i) => {
      const cell = document.createElement("span");
      cell.className = i === 0 ? "flip-when" : "flip-when flip-num";
      if (marked[i]) cell.classList.add("is-selected");
      cell.textContent = text;
      li.append(cell);
    });
    return li;
  };

  list.append(row([c.spreadColWay, c.spreadCalendar, c.spreadRolling], "flip-head"));
  for (const r of rows) {
    list.append(row(
      [r.label, ...r.cells.map((cell) => ordinal(cell.percentile))],
      "", [false, ...r.cells.map((cell) => cell.selected)]));
  }
  box.append(list);
  el.spreadChart.replaceChildren(box);
}

/* ---------------- map ---------------- */

let land: Awaited<ReturnType<typeof loadLand>> | null = null;

/** First index whose time is >= `t`, over the time-sorted tier. */
function lowerBound(tier: Tier, t: number): number {
  let lo = 0;
  let hi = tier.n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tier.time[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Events for every highlighted year, coloured to match their chart lines.
 *
 * Each year's slice is found by binary search rather than scanning the tier,
 * which matters at M4.5 where a full pass is 294k rows on every re-render.
 */
function highlightedEvents(tier: Tier, minMag: number, highlights: Highlight[],
                           shift: number): MapEvent[] {
  const out: MapEvent[] = [];
  const mainshocksOnly = effectiveMainshocksOnly();

  for (const { year, color } of highlights) {
    const start = lowerBound(tier, Date.UTC(year, 0, 1) + shift);
    const end = lowerBound(tier, Date.UTC(year + 1, 0, 1) + shift);
    for (let i = start; i < end; i++) {
      if (tier.mag[i] < minMag) continue;
      if (mainshocksOnly && tier.dependent[i]) continue;
      out.push({ lat: tier.lat[i], lon: tier.lon[i], mag: tier.mag[i], year, color,
                 time: tier.time[i] });
    }

    const cutoff = tier.info.lastTime ?? 0;
    for (const event of liveEvents) {
      const { year: liveYear } = dayIndex(event.time, shift);
      if (liveYear !== year || event.mag < minMag || event.time <= cutoff) continue;
      out.push({ lat: event.lat, lon: event.lon, mag: event.mag, year, color,
                 time: event.time });
    }
  }
  // Largest first, so the small dots land on top and stay visible inside a big
  // one. Plot would impose this order itself, but the map/list hover join needs
  // the drawing order to be one we know, so the mark takes sort: null and this
  // is where it is decided.
  return out.sort((a, b) => b.mag - a.mag);
}

/** Which colour is which year, so the map can carry no caption at all. */
function buildMapLegend(highlights: Highlight[]) {
  el.mapLegend.replaceChildren();
  if (highlights.length === 0) {
    el.mapLegend.textContent = copy.home.mapEmpty;
    return;
  }
  for (const { year, color } of highlights) {
    const entry = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = "dot-swatch";
    dot.style.background = color;
    entry.append(dot, document.createTextNode(yearLabel(year)));
    el.mapLegend.append(entry);
  }
}

/* ---------------- largest events ---------------- */

const USGS_EVENT_PAGE = "https://earthquake.usgs.gov/earthquakes/eventpage/";

/** ComCat event id -> Earthquake Insights post. Hand-maintained; see posts.json. */
let posts: Record<string, string> = {};

async function loadPosts() {
  try {
    const res = await fetch(`${DATA_BASE}/posts.json`);
    if (res.ok) posts = (await res.json()).posts ?? {};
  } catch {
    // The links are a bonus; their absence should never break the panel.
  }
}

interface EventRow {
  id: string;
  mag: number;
  time: number;
  place: string;
  year: number;
  color: string;
}

/**
 * The list beside the map, over exactly the years highlighted at the top.
 *
 * It used to carry a year dropdown of its own, which meant the panel could sit
 * on 2011 while the map and both charts showed 2026. Everything on this row now
 * answers to the same controls.
 */
async function updateLargest(highlights: Highlight[], shift: number): Promise<EventRow[]> {
  el.largestHeading.textContent = highlights.map((h) => h.label).join(", ");

  if (highlights.length === 0) {
    el.largestList.replaceChildren();
    el.largestNote.textContent = copy.home.largestNoYears;
    return [];
  }

  const info = store.detailTierFor(state.minMag);
  if (!info) {
    el.largestList.replaceChildren();
    el.largestNote.textContent = copy.home.largestNoDetail;
    return [];
  }

  let tier: Tier;
  let detail: Awaited<ReturnType<typeof store.loadDetail>>;
  try {
    [tier, detail] = await Promise.all([store.load(info.threshold), store.loadDetail(info)]);
  } catch {
    el.largestNote.textContent = copy.home.largestFailed;
    return [];
  }

  const cutoff = tier.info.lastTime ?? 0;
  const mainshocksOnly = effectiveMainshocksOnly();
  const rows: EventRow[] = [];

  for (const { year, color } of highlights) {
    const yearStart = Date.UTC(year, 0, 1) + shift;
    const yearEnd = Date.UTC(year + 1, 0, 1) + shift;

    for (let i = tier.n - 1; i >= 0; i--) {
      if (tier.time[i] < yearStart) break;
      if (tier.time[i] >= yearEnd) continue;
      if (mainshocksOnly && tier.dependent[i]) continue;
      rows.push({
        id: detail.ids[i], mag: tier.mag[i], time: tier.time[i],
        place: detail.places[i] || "Location unavailable",
        year, color,
      });
    }

    // The live feed carries ids and place names of its own, so events too recent
    // for the static build reach the list rather than showing up only in counts.
    for (const event of liveEvents) {
      if (event.time <= cutoff || event.time < yearStart || event.time >= yearEnd) continue;
      if (event.mag < info.threshold) continue;
      rows.push({
        id: event.id, mag: event.mag, time: event.time,
        place: event.place || "Location unavailable",
        year, color,
      });
    }
  }

  rows.sort(state.sortMode === "recent"
    ? (a, b) => b.time - a.time || b.mag - a.mag
    : (a, b) => b.mag - a.mag || b.time - a.time);

  const shown = rows.slice(0, EVENT_LIST_LIMIT);
  el.largestList.replaceChildren();
  for (const row of shown) {
    const item = document.createElement("li");
    // The key the map dots are joined on; see MapEvent.time.
    item.dataset.time = String(row.time);

    const link = document.createElement("a");
    link.href = `${USGS_EVENT_PAGE}${row.id}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "largest-main";
    link.innerHTML =
      `<span class="largest-mag"></span><span class="largest-place"></span>`;
    const mag = link.querySelector<HTMLElement>(".largest-mag")!;
    mag.textContent = `M${row.mag.toFixed(1)}`;
    // Same accent the year wears on the chart, the map and the legend, so the
    // reader can tell which highlighted year a row belongs to without a label.
    mag.style.color = row.color;
    link.querySelector(".largest-place")!.textContent = row.place;
    item.append(link);

    const when = document.createElement("span");
    when.className = "largest-date";
    when.textContent = new Date(row.time).toLocaleDateString(undefined, {
      day: "numeric", month: "short",
      year: highlights.length > 1 ? "2-digit" : undefined,
      timeZone: "UTC",
    });
    item.append(when);

    const post = posts[row.id];
    if (post) {
      const analysis = document.createElement("a");
      analysis.href = post;
      analysis.target = "_blank";
      analysis.rel = "noopener noreferrer";
      analysis.className = "largest-post";
      analysis.textContent = copy.home.readAnalysis;
      item.append(analysis);
    }
    el.largestList.append(item);
  }

  const kind = mainshocksOnly ? "mainshocks" : "earthquakes";
  const threshold = `M${info.threshold}+`;
  const years = highlights.map((h) => h.label).join(", ");
  if (shown.length === 0) {
    el.largestNote.textContent = fill(copy.home.largestEmpty, { threshold, kind, years });
    return [];
  }
  el.largestNote.textContent = fill(
    rows.length > shown.length ? copy.home.largestTruncated : copy.home.largestNote,
    { n: rows.length, threshold, kind, shown: shown.length });
  return shown;
}

/**
 * Hovering a dot lights its row in the list, and hovering a row lights its dot.
 *
 * Joined on origin time -- see MapEvent.time for why that and not the event id.
 * Plot emits one circle per datum in data order, which is how a circle is
 * matched back to an event; if that ever stopped being true the join would
 * silently pair the wrong dot with the wrong row, so a length mismatch gives up
 * on the linking rather than guessing.
 */
function linkMapAndList(events: MapEvent[], theme: Theme) {
  const svg = el.map.querySelector("svg");
  if (!svg) return;
  const dots = [...svg.querySelectorAll<SVGCircleElement>('g[aria-label="dot"] circle')];
  if (dots.length !== events.length) return;

  const dotByTime = new Map<number, SVGCircleElement>();
  events.forEach((event, i) => dotByTime.set(event.time, dots[i]));

  const rowByTime = new Map<number, HTMLElement>();
  for (const li of el.largestList.querySelectorAll<HTMLElement>("li[data-time]")) {
    rowByTime.set(Number(li.dataset.time), li);
  }

  // Plot sets stroke and fill-opacity on the mark's group, so overriding them
  // per-circle lifts one dot and removing the attributes puts it back.
  const lightDot = (dot: SVGCircleElement | undefined, on: boolean) => {
    if (!dot) return;
    if (on) {
      dot.setAttribute("stroke", theme.text);
      dot.setAttribute("stroke-width", "1.8");
      dot.setAttribute("fill-opacity", "1");
      // Last child paints on top, so a dot under a neighbour still shows.
      dot.parentNode?.appendChild(dot);
    } else {
      dot.removeAttribute("stroke");
      dot.removeAttribute("stroke-width");
      dot.removeAttribute("fill-opacity");
    }
  };

  for (const [time, row] of rowByTime) {
    const dot = dotByTime.get(time);
    row.addEventListener("mouseenter", () => lightDot(dot, true));
    row.addEventListener("mouseleave", () => lightDot(dot, false));
  }

  // Delegated rather than one listener per circle: a five-year M6+ selection is
  // several hundred dots, and they are all replaced on every re-render.
  let lit: HTMLElement | null = null;
  const clear = () => {
    lit?.classList.remove("is-linked");
    lit = null;
  };
  svg.addEventListener("mouseover", (ev) => {
    const target = ev.target as Element;
    if (!(target instanceof SVGCircleElement)) return;
    const index = dots.indexOf(target);
    if (index < 0) return;
    const row = rowByTime.get(events[index].time);
    if (row === lit) return;
    clear();
    if (!row) return;
    row.classList.add("is-linked");
    // The list scrolls, so a dot in the Pacific can point at a row that is not
    // on screen. Nearest scrolls only when it has to.
    row.scrollIntoView({ block: "nearest" });
    lit = row;
  });
  svg.addEventListener("mouseleave", clear);
}

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
function signedPct(v: number): string {
  return `${v >= 0 ? "+" : "\u2212"}${Math.abs(v).toFixed(1)}%`;
}

const TREND_SERIES = [
  { threshold: MIN_MAGNITUDE, mainshocksOnly: false },
  { threshold: MIN_MAGNITUDE, mainshocksOnly: true },
  { threshold: MAJOR_MAGNITUDE, mainshocksOnly: false },
  { threshold: MAJOR_MAGNITUDE, mainshocksOnly: true },
];

/**
 * The permutation test is a hundred thousand shuffles, about 130ms. Every
 * resize re-renders, and the catalogue has not changed in between, so it is
 * held against a signature of the data rather than recomputed.
 */
const jointCache = new Map<string, number>();

function combinedFor(panels: { points: { year: number; value: number }[] }[]): number | null {
  const key = panels
    .map((p) => `${p.points.length}:${p.points.at(-1)?.year}:`
              + p.points.reduce((a, c) => a + c.value, 0))
    .join("|");
  const hit = jointCache.get(key);
  if (hit !== undefined) return hit;
  const value = combinedTrendP(panels.map((p) => p.points));
  if (value === null) return null;
  jointCache.set(key, value);
  return value;
}

/**
 * How strongly the four series move together, as a range.
 *
 * Quoted on the page rather than asserted, because it is the reason the
 * textbook correction is not used, and because it moves with the catalogue.
 */
function correlationRange(cols: number[][]): { min: number; max: number } | null {
  const centred = cols.map((c) => {
    const mean = c.reduce((a, v) => a + v, 0) / c.length;
    return c.map((v) => v - mean);
  });
  const pairs: number[] = [];
  for (let i = 0; i < centred.length; i++) {
    for (let j = i + 1; j < centred.length; j++) {
      const a = centred[i], b = centred[j];
      const num = a.reduce((acc, v, k) => acc + v * b[k], 0);
      const den = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0)
                          * b.reduce((acc, v) => acc + v * v, 0));
      if (den > 0) pairs.push(num / den);
    }
  }
  if (!pairs.length) return null;
  return { min: Math.min(...pairs), max: Math.max(...pairs) };
}

interface TrendPanel {
  title: string;
  axis: string;
  points: { year: number; value: number }[];
  fit: Trend;
}

/**
 * Whole-year totals for one series, on the calendar, ignoring every toggle.
 *
 * Deliberately not derived from the annual chart's numbers: those follow the
 * measure, the magnitude, the decluster switch and the rolling-window shift,
 * which is exactly the dependence this section exists to remove.
 */
function trendPoints(tier: Tier, threshold: number, mainshocksOnly: boolean,
                     currentYear: number): { year: number; value: number }[] {
  const curves = cumulativeByYear(tier, threshold, REFERENCE_START, mainshocksOnly, "count", 0);
  return curves.years
    .filter((y) => y >= REFERENCE_START && y < currentYear)
    .map((y) => ({ year: y, value: curves.curves.get(y)![DAYS - 1] }));
}

async function writeTrend(currentYear: number, theme: ReturnType<typeof readTheme>,
                          width: number) {
  const c = copy.home;
  let tier: Tier;
  try {
    // Always the M6 tier, whatever is selected above: it holds every M7+ event
    // too, so both thresholds come from one load, and the store caches it.
    tier = await store.load(MIN_MAGNITUDE);
  } catch {
    el.trendQuestion.textContent = "";
    return;
  }

  const panels: TrendPanel[] = [];
  for (const spec of TREND_SERIES) {
    const points = trendPoints(tier, spec.threshold, spec.mainshocksOnly, currentYear);
    const fit = trend(points);
    if (!fit) continue;
    const threshold = magLabel(spec.threshold);
    panels.push({
      title: fill(spec.mainshocksOnly ? c.trendPanelMainshocks : c.trendPanelAll, { threshold }),
      axis: fill(c.trendPanelAxis, { threshold }),
      points, fit,
    });
  }
  if (!panels.length) { el.trendQuestion.textContent = ""; return; }

  const outcome = (p: number) => (p < 0.01 ? "probably" : p < 0.05 ? "maybe" : "no");
  const steepest = panels.reduce((a, b) => (b.fit.p < a.fit.p ? b : a));
  // Measured, not assumed. Sidak would be 1 - (1 - p)^4, but the four series
  // are nested and correlate between 0.11 and 0.80, so that formula over-states
  // the correction -- 25% where the answer is 20%. See combinedTrendP.
  const corrected = combinedFor(panels);
  if (corrected === null) { el.trendQuestion.textContent = ""; return; }
  // Graded on the combined number, not the smallest. Reporting the best of
  // four tests as though it were the only one is the whole failure mode this
  // section was rebuilt to avoid, so the number that decides the answer is the
  // one that has paid for the four looks.
  const key = outcome(corrected);
  const pct = (n: number) => (100 * n).toFixed(0);

  el.trendQuestion.textContent = c.trendQuestion;
  el.trendVerdict.textContent = key === "probably" ? copy.correlations.verdictProbably
                              : key === "maybe" ? copy.correlations.verdictMaybe
                              : copy.correlations.verdictNo;

  el.trendBody.textContent = fill(c.trendIntro, {
    threshold: magLabel(MIN_MAGNITUDE), major: magLabel(MAJOR_MAGNITUDE),
  }) + "\n\n" + fill(
    key === "probably" ? c.trendProbably : key === "maybe" ? c.trendMaybe : c.trendNo,
    { subject: steepest.title, p: pct(steepest.fit.p), corrected: pct(corrected) });

  const corr = correlationRange(panels.map((p) => p.points.map((d) => d.value)));
  el.trendOverlap.textContent = fill(c.trendOverlap, {
    threshold: magLabel(MIN_MAGNITUDE), major: magLabel(MAJOR_MAGNITUDE),
    minCorr: corr ? corr.min.toFixed(2) : "—",
    maxCorr: corr ? corr.max.toFixed(2) : "—",
  });

  // One column, not two. The smallest p-value used to sit beside the combined
  // one, which invited the reader to grade off whichever looked better; it is
  // still reported, in the prose and under each panel, where it cannot be
  // mistaken for the deciding number.
  const cc = copy.correlations;
  el.trendTable.replaceChildren(flipTable(
    [{ label: c.trendColCombined,
       help: { label: c.trendHelp,
               body: fill(c.trendHelpBody, {
                 years: steepest.fit.years, p: pct(steepest.fit.p),
                 subject: steepest.title, corrected: pct(corrected),
                 permutations: TREND_PERMUTATIONS.toLocaleString(),
               }) } },
     { label: cc.flipColAnswer }],
    [
      [cc.flipPStrong, cc.verdictProbably],
      [cc.flipPWeak, cc.verdictMaybe],
      [cc.flipPNone, cc.verdictNo],
    ],
    key === "probably" ? 0 : key === "maybe" ? 1 : 2,
    [fill(cc.flipNow, { value: `${pct(corrected)}%` }), null],
  ));

  // Two across, so each panel gets about half the section width less the gap.
  const panelWidth = Math.max(240, Math.floor((width - 28) / 2));
  el.trendGrid.replaceChildren(...panels.map((panel) => {
    const box = document.createElement("figure");
    box.className = "trend-panel";

    const title = document.createElement("figcaption");
    title.className = "trend-panel-title";
    title.textContent = panel.title;

    const host = document.createElement("div");
    host.className = "trend-panel-chart";
    host.append(renderTrendChart(panel, theme, panelWidth));

    const stat = document.createElement("p");
    stat.className = "trend-panel-stat";
    const share = (v: number) => (100 * v) / panel.fit.mean;
    stat.textContent = fill(c.trendPanelStat, {
      low: signedPct(share(panel.fit.perDecade - panel.fit.margin)),
      high: signedPct(share(panel.fit.perDecade + panel.fit.margin)),
      p: pct(panel.fit.p),
    });

    box.append(title, host, stat);
    return box;
  }));
}

/** The fitted line and its 95% band, as marks. */
function renderTrendChart(panel: TrendPanel, theme: ReturnType<typeof readTheme>,
                          width: number) {
  const t = panel.fit;
  const mid = (t.first + t.last) / 2;
  const at = (year: number) => t.mean + (t.perDecade / 10) * (year - mid);
  const halfAt = (year: number) => (t.margin / 10) * Math.abs(year - mid);
  const band = panel.points.map((p) => ({
    year: p.year, lo: at(p.year) - halfAt(p.year), hi: at(p.year) + halfAt(p.year),
  }));
  return renderTrend({
    points: panel.points,
    line: [{ year: t.first, value: at(t.first) }, { year: t.last, value: at(t.last) }],
    band, theme, width,
    yLabel: panel.axis,
    wholeNumbers: true,
    compact: true,
  });
}

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

  const shift = calendarShift();
  const { year: currentYear } = dayIndex(Date.now(), shift);
  // A rolling window always ends today, so it is complete: the current "year"
  // runs the full 365 days, and is compared only against equally complete ones.
  const rolling = state.window === "rolling";
  const today = rolling ? DAYS - 1 : dayIndex(Date.now(), shift).day;

  const mainshocksOnly = effectiveMainshocksOnly();
  const curves = cumulativeByYear(
    tier, minMag, REFERENCE_START, mainshocksOnly, state.measure, shift);
  const splitMajor = minMag < MAJOR_MAGNITUDE;
  const majorCurves = splitMajor
    ? cumulativeByYear(
        tier, MAJOR_MAGNITUDE, REFERENCE_START, mainshocksOnly, state.measure, shift)
    : { curves: new Map<number, Float64Array>(), years: [], matched: 0 };
  const liveAdded = applyLive(curves, tier, minMag, shift);

  const refYears = curves.years.filter((y) => y >= REFERENCE_START && y < currentYear);
  const percentiles = empiricalBand(curves, refYears, state.measure);
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
  // Before the headline, because the headline is now read off it. Every way of
  // counting the year, pooled -- see spreadTable.
  const spread = spreadTable(tier);
  // The one number the controls cannot move. Falling back to the selected
  // slice only if the pooling could not be done at all, which needs three
  // years of catalogue.
  const headlinePct = spread.aggregate
    ? 100 * (1 - spread.aggregate.p)
    : (result ? result.percentile * 100 : null);

  const counts = annualCounts(curves, majorCurves, currentYear, today, refYears,
                             state.measure);
  const kind = effectiveMainshocksOnly() ? "mainshocks" : "earthquakes";
  const subject = state.measure === "moment"
    ? fill(copy.home.cumulativeSubjectMoment, { threshold: magLabel(minMag) })
    : fill(copy.home.cumulativeSubjectCount, { threshold: magLabel(minMag), kind });

  writeHeadline(result, currentYear, headlinePct);
  void writeLatest(minMag);
  buildAnswerScale(headlinePct, yearLabel(currentYear));
  writeNote(refYears.length, liveAdded);
  writeAnnualNote(currentYear, splitMajor, rolling);

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

    // Day 0 of the window is 1 January only in the calendar view; the rolling
    // view starts it on today's date, so the axis has to be told.
    const dayToDate = (day: number) => {
      const start = Date.UTC(currentYear, 0, 1) + shift;
      const end = Date.UTC(currentYear + 1, 0, 1) + shift;
      return new Date(start + (day / DAYS) * (end - start));
    };

    const width = Math.max(320, el.chart.clientWidth || 800);

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
        value: moment ? asMagnitude(result.count) : result.count,
        share: {
          more: fill(copy.home.stripShare, { share: above }),
          moreLabel: fill(
            moment ? copy.home.stripShareMoreMoment : copy.home.stripShareMore,
            {
              subject: `${magLabel(minMag)} ${kind}`,
              // The calendar view counts up to today, and the number means
              // nothing without saying so; the rolling view is a full twelve
              // months and has no such date.
              when: rolling ? "" : fill(copy.home.stripShareBy, {
                date: new Date().toLocaleDateString(undefined,
                                                    { day: "numeric", month: "long" }),
              }),
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
      counts, highlights, refYears, theme, width,
      yLabel: state.measure === "moment"
        ? copy.home.axisAnnualMoment
        : fill(copy.home.axisAnnualCount, { threshold: magLabel(minMag) }),
      wholeNumbers: state.measure === "count",
      sigma: annualSigma,
      yMax: Math.max(0, ...counts.map((c) => Math.max(c.count, c.projected))),
    }));

    writeSpread(spread, currentYear);
    void writeTrend(currentYear, theme, width);

    const mapEvents = highlightedEvents(tier, minMag, highlights, shift);
    buildMapLegend(highlights);
    el.mapTitle.textContent = fill(copy.home.mapTitle, { threshold: magLabel(minMag) });

    if (land) {
      el.map.replaceChildren(renderMap({ land, events: mapEvents, theme, width }));
    }

    void updateLargest(highlights, shift).then(() => linkMapAndList(mapEvents, theme));
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
                       pooled: number | null) {
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

  const roll = state.window === "rolling";
  // Never the rolling wording: the pooled figure is built from calendar years
  // only, because a 365-day window ending today is not a year and cannot be
  // ranked against past ones. See spreadTable.
  el.answer.innerHTML = fill(answerFor(pooled ?? result.percentile * 100, false),
                             { year: yearLabel(currentYear), from: REFERENCE_START });

  const shared = {
    from: REFERENCE_START, to: currentYear - 1,
    above: Math.round(result.aboveShare * 100),
  };
  el.answerSummary.textContent = moment
    ? fill(roll ? copy.home.detailMomentRolling : copy.home.detailMoment, {
        ...shared, count: withUnit(result.count),
        equivalent: equivalentMagnitude(result.count).toFixed(1),
        median: withUnit(result.medianToDate),
      })
    : fill(roll ? copy.home.detailCountRolling : copy.home.detailCount, {
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
    { major: magLabel(MAJOR_MAGNITUDE), year: yearLabel(currentYear) });
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

  await Promise.all([pollLive(newestTime()), loadPosts()]);
  await update();

  // Coastlines arrive after the first paint; the charts do not wait on them.
  loadLand().then((geo) => { land = geo; lastRender?.(); })
    .catch(() => { el.mapLegend.textContent = copy.home.errorBasemap; });

  window.setInterval(async () => {
    await refreshCatalog();
    await pollLive(newestTime());
    await update();
  }, LIVE_INTERVAL_MS);
}

renderTech(copy.home.techTitle, copy.home.techBody, el.techTitle, el.techBody);
startAnalytics();
void boot();
