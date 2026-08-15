import { CatalogStore, DATA_BASE, loadMeta, type Meta, type Tier } from "./catalog";
import { renderAnnualChart, renderChart, readTheme, type Highlight } from "./chart";
import {
  DAYS, MAGNITUDES, MAJOR_MAGNITUDE, MIN_MAGNITUDE, annualCounts, cumulativeByYear,
  dayIndex, empiricalBand, equivalentMagnitude, verdict, type Measure, type YearCurves,
} from "./stats";
import { loadLand, renderMap, type MapEvent } from "./map";
import { copy, fill } from "./copy";

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
  /** Year shown in the event list; independent of the highlighted years. */
  listYear: number | null;
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
  listYear: null,
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
function calendarShift(): number {
  if (state.window === "calendar") return 0;
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
  largestYear: document.getElementById("largest-year") as HTMLSelectElement,
  largestList: document.getElementById("largest-list")!,
  largestNote: document.getElementById("largest-note")!,
  generated: document.getElementById("generated")!,
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


function ordinal(n: number): string {
  const v = Math.round(n);
  const suffix = v % 100 >= 11 && v % 100 <= 13 ? "th"
    : ["th", "st", "nd", "rd"][v % 10] ?? "th";
  return `${v}${suffix}`;
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
  buildSegmented(el.window, WINDOWS.map((w) => ({ id: w.id, label: w.label })),
    () => state.window, (id) => {
      state.window = id as State["window"];
      // "2025" means the calendar year in one mode and August-to-August in the
      // other. Carrying a selection across would quietly point it elsewhere.
      state.highlights.clear();
      state.listYear = null;
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
  // Options are rebuilt on every render, so the listener is attached once here
  // rather than in buildListYears, which would stack duplicates.
  el.largestYear.addEventListener("change", () => {
    state.listYear = Number(el.largestYear.value);
    void update();
  });
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
      out.push({ lat: tier.lat[i], lon: tier.lon[i], mag: tier.mag[i], year, color });
    }

    const cutoff = tier.info.lastTime ?? 0;
    for (const event of liveEvents) {
      const { year: liveYear } = dayIndex(event.time, shift);
      if (liveYear !== year || event.mag < minMag || event.time <= cutoff) continue;
      out.push({ lat: event.lat, lon: event.lon, mag: event.mag, year, color });
    }
  }
  // Largest last so great earthquakes are not buried under the small ones.
  return out.sort((a, b) => a.mag - b.mag);
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

/** Fills the list's year dropdown, keeping the reader's choice if still valid. */
function buildListYears(years: number[], currentYear: number) {
  const available = years.length ? [...years].sort((a, b) => b - a) : [currentYear];
  if (state.listYear === null || !available.includes(state.listYear)) {
    state.listYear = available.includes(currentYear) ? currentYear : available[0];
  }
  if (el.largestYear.options.length === available.length &&
      el.largestYear.value === String(state.listYear)) {
    return;
  }
  el.largestYear.replaceChildren();
  for (const year of available) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = yearLabel(year);
    option.selected = year === state.listYear;
    el.largestYear.append(option);
  }
}

async function updateLargest(listYear: number, shift: number) {
  const info = store.detailTierFor(state.minMag);
  if (!info) {
    el.largestList.replaceChildren();
    el.largestNote.textContent = copy.home.largestNoDetail;
    return;
  }

  let tier: Tier;
  let detail: Awaited<ReturnType<typeof store.loadDetail>>;
  try {
    [tier, detail] = await Promise.all([store.load(info.threshold), store.loadDetail(info)]);
  } catch {
    el.largestNote.textContent = copy.home.largestFailed;
    return;
  }

  const yearStart = Date.UTC(listYear, 0, 1) + shift;
  const yearEnd = Date.UTC(listYear + 1, 0, 1) + shift;
  const cutoff = tier.info.lastTime ?? 0;
  const rows: { id: string; mag: number; time: number; place: string }[] = [];

  for (let i = tier.n - 1; i >= 0; i--) {
    if (tier.time[i] < yearStart) break;
    if (tier.time[i] >= yearEnd) continue;
    if (effectiveMainshocksOnly() && tier.dependent[i]) continue;
    rows.push({
      id: detail.ids[i], mag: tier.mag[i], time: tier.time[i],
      place: detail.places[i] || "Location unavailable",
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
    });
  }

  rows.sort(state.sortMode === "recent"
    ? (a, b) => b.time - a.time || b.mag - a.mag
    : (a, b) => b.mag - a.mag || b.time - a.time);

  const shown = rows.slice(0, EVENT_LIST_LIMIT);
  el.largestList.replaceChildren();
  for (const row of shown) {
    const item = document.createElement("li");

    const link = document.createElement("a");
    link.href = `${USGS_EVENT_PAGE}${row.id}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "largest-main";
    link.innerHTML =
      `<span class="largest-mag">M${row.mag.toFixed(1)}</span><span class="largest-place"></span>`;
    link.querySelector(".largest-place")!.textContent = row.place;
    item.append(link);

    const when = document.createElement("span");
    when.className = "largest-date";
    when.textContent = new Date(row.time).toLocaleDateString(undefined, {
      day: "numeric", month: "short", timeZone: "UTC",
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

  const kind = effectiveMainshocksOnly() ? "mainshocks" : "earthquakes";
  const threshold = `M${info.threshold}+`;
  if (shown.length === 0) {
    el.largestNote.textContent = fill(copy.home.largestEmpty,
      { threshold, kind, year: yearLabel(listYear) });
    return;
  }
  el.largestNote.textContent = fill(
    rows.length > shown.length ? copy.home.largestTruncated : copy.home.largestNote,
    { n: rows.length, threshold, kind, shown: shown.length });
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
  const band = empiricalBand(curves, refYears);
  const result = verdict(curves, refYears, currentYear, today);

  const counts = annualCounts(curves, majorCurves, currentYear, today, refYears);
  const kind = effectiveMainshocksOnly() ? "mainshocks" : "earthquakes";
  const subject = state.measure === "moment"
    ? fill(copy.home.cumulativeSubjectMoment, { threshold: magLabel(minMag) })
    : fill(copy.home.cumulativeSubjectCount, { threshold: magLabel(minMag), kind });

  writeHeadline(result, currentYear);
  writeNote(refYears.length, liveAdded);
  writeAnnualNote(currentYear, splitMajor, rolling);

  buildListYears(curves.years, currentYear);
  void updateLargest(state.listYear ?? currentYear, shift);

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
    const figure = renderChart({
      curves, band, refYears, highlights, today, theme, width, dayToDate,
      yLabel: state.measure === "moment"
        ? copy.home.axisCumulativeMoment
        : fill(copy.home.axisCumulativeCount, { threshold: magLabel(minMag) }),
      wholeNumbers: state.measure === "count",
    });
    el.chart.replaceChildren(figure);
    figure.after(buildLegend(theme, highlights, REFERENCE_START, currentYear - 1));

    el.annualChart.replaceChildren(renderAnnualChart({
      counts, highlights, refYears, theme, width,
      yLabel: state.measure === "moment"
        ? copy.home.axisAnnualMoment
        : fill(copy.home.axisAnnualCount, { threshold: magLabel(minMag) }),
      wholeNumbers: state.measure === "count",
    }));

    const mapEvents = highlightedEvents(tier, minMag, highlights, shift);
    buildMapLegend(highlights);
    el.mapTitle.textContent = fill(copy.home.mapTitle, { threshold: magLabel(minMag) });

    if (land) {
      el.map.replaceChildren(renderMap({ land, events: mapEvents, theme, width }));
    }
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
    { color: theme.median, label: copy.home.legendMedian, kind: "dashed" },
    { color: theme.bandInner, label: copy.home.legendBandInner, kind: "band" },
    { color: theme.band, label: copy.home.legendBand, kind: "band" },
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
function writeHeadline(result: ReturnType<typeof verdict>, currentYear: number) {
  const kind = effectiveMainshocksOnly() ? "mainshocks" : "earthquakes";
  const moment = state.measure === "moment";

  if (!result || result.count === 0) {
    el.answer.innerHTML = copy.home.answerNothingYet;
    el.answerDetail.textContent = moment
      ? fill(copy.home.detailNoneMoment, { year: yearLabel(currentYear) })
      : fill(copy.home.detailNoneCount,
             { threshold: magLabel(state.minMag), kind, year: yearLabel(currentYear) });
    return;
  }

  const pct = result.percentile * 100;

  const roll = state.window === "rolling";
  const answer = pct > 95 ? (roll ? copy.home.rollingBusiest : copy.home.answerBusiest)
    : pct < 5 ? (roll ? copy.home.rollingQuietest : copy.home.answerQuietest)
    : pct >= 75 ? (roll ? copy.home.rollingBusy : copy.home.answerBusy)
    : pct <= 25 ? (roll ? copy.home.rollingQuiet : copy.home.answerQuiet)
    : (roll ? copy.home.rollingAverage : copy.home.answerAverage);
  el.answer.innerHTML = fill(answer, { year: yearLabel(currentYear), from: REFERENCE_START });

  const shared = { from: REFERENCE_START, to: currentYear - 1, percentile: ordinal(pct) };
  el.answerDetail.textContent = moment
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
  const notes: string[] = [fill(copy.home.noteBand, { years: refCount })];

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
window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => lastRender?.());

async function boot() {
  try {
    meta = await loadMeta();
  } catch (err) {
    el.answer.textContent = "Could not load the catalogue.";
    el.answerDetail.textContent = fill(copy.home.errorBoot,
      { message: (err as Error).message });
    return;
  }

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

  const newest = Math.max(...meta.tiers.map((t) => t.lastTime ?? 0));
  await Promise.all([pollLive(newest), loadPosts()]);
  await update();

  // Coastlines arrive after the first paint; the charts do not wait on them.
  loadLand().then((geo) => { land = geo; lastRender?.(); })
    .catch(() => { el.mapLegend.textContent = copy.home.errorBasemap; });

  window.setInterval(async () => {
    await pollLive(newest);
    await update();
  }, LIVE_INTERVAL_MS);
}

void boot();
