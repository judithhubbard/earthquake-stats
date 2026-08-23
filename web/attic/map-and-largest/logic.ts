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


async function loadPosts() {
  try {
    const res = await fetch(`${DATA_BASE}/posts.json`);
    if (res.ok) posts = (await res.json()).posts ?? {};
  } catch {
    // The links are a bonus; their absence should never break the panel.
  }
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


// from update():
    const mapEvents = highlightedEvents(tier, minMag, highlights, shift);
    buildMapLegend(highlights);
    el.mapTitle.textContent = fill(copy.home.mapTitle, { threshold: magLabel(minMag) });

    if (land) {
      el.map.replaceChildren(renderMap({ land, events: mapEvents, theme, width }));
    }

    void updateLargest(highlights, shift).then(() => linkMapAndList(mapEvents, theme));


// ---- also removed ----
const SORT_MODES = [
  { id: "largest", label: "Largest" },
  { id: "recent", label: "Recent" },
] as const;


/** The panel scrolls, so this only needs to be past any plausible year's count. */
const EVENT_LIST_LIMIT = 250;


  buildSegmented(el.sort, SORT_MODES.map((s) => ({ id: s.id, label: s.label })),
    () => state.sortMode, (id) => { state.sortMode = id as State["sortMode"]; });


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


const USGS_EVENT_PAGE = "https://earthquake.usgs.gov/earthquakes/eventpage/";


/** ComCat event id -> Earthquake Insights post. Hand-maintained; see posts.json. */
let posts: Record<string, string> = {};


interface EventRow {
  id: string;
  mag: number;
  time: number;
  place: string;
  year: number;
  color: string;
}
