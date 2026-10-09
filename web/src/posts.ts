/**
 * The posts page: every Earthquake Insights post on a map, at the USGS events
 * it links to, and the whole archive as a searchable list under it.
 *
 * pipeline/posts.py builds the data. A post's `events` are the earthquakes it
 * is about and are drawn; its `context` are earlier ones it cites, drawn only
 * while it is selected, so a decade of posts citing 1999 Izmit does not put a
 * pile of circles on 1999 Izmit. A post with no event but a `place` (the old
 * map's hand-placed points, regional essays) is drawn as a ring.
 *
 * One circle per earthquake, not per post: five posts about Kamchatka are one
 * circle that lists five posts when selected.
 */

import * as Plot from "@observablehq/plot";
import { DATA_BASE } from "./catalog";
import { readTheme } from "./chart";
import { loadLand, worldProjection } from "./map";
import { startAnalytics } from "./analytics";

interface Post {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  free: boolean;
  section: string;
  cover: string;
  events: string[];
  context: string[];
  place: { lat: number; lon: number; label: string } | null;
}

interface QuakeEvent {
  lat: number;
  lon: number;
  depth: number | null;
  mag: number;
  time: number;
  place: string;
}

interface Data {
  posts: Post[];
  events: Record<string, QuakeEvent>;
}

interface Point {
  key: string;
  lat: number;
  lon: number;
  /** null for a place rather than an earthquake. */
  mag: number | null;
  label: string;
  posts: Post[];
}

type Show = "all" | "free" | "quakes" | "tectonics";

const SUBSTACK = "https://earthquakeinsights.substack.com/p/";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const el = {
  map: $<HTMLDivElement>("posts-map"),
  legend: $<HTMLParagraphElement>("posts-legend"),
  selected: $<HTMLDivElement>("posts-selected"),
  search: $<HTMLInputElement>("posts-search"),
  show: $<HTMLSpanElement>("posts-show"),
  count: $<HTMLParagraphElement>("posts-count"),
  list: $<HTMLDivElement>("posts-list"),
  generated: $<HTMLParagraphElement>("generated"),
};

const state = {
  data: null as Data | null,
  points: [] as Point[],
  land: null as unknown,
  plates: null as unknown,
  selected: null as Point | null,
  query: "",
  show: "all" as Show,
};

// ---------- formatting ----------

const fmtDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function eventLine(e: QuakeEvent): string {
  const depth = e.depth !== null && e.depth >= 70 ? `, ${Math.round(e.depth)} km deep` : "";
  return `M${e.mag.toFixed(1)} ${e.place}${depth} · ${fmtDate(e.time)}`;
}

// ---------- data ----------

function buildPoints(data: Data): Point[] {
  const byKey = new Map<string, Point>();
  for (const post of data.posts) {
    if (post.events.length) {
      for (const id of post.events) {
        const e = data.events[id];
        if (!e) continue;
        let p = byKey.get(id);
        if (!p) {
          p = { key: id, lat: e.lat, lon: e.lon, mag: e.mag, label: eventLine(e), posts: [] };
          byKey.set(id, p);
        }
        p.posts.push(post);
      }
    } else if (post.place) {
      // Hand-placed points for posts about the same thing sit on the same spot.
      const key = `place:${post.place.lat.toFixed(1)},${post.place.lon.toFixed(1)}`;
      let p = byKey.get(key);
      if (!p) {
        p = { key, lat: post.place.lat, lon: post.place.lon, mag: null, label: post.place.label, posts: [] };
        byKey.set(key, p);
      }
      p.posts.push(post);
    }
  }
  // Largest first, so small circles are drawn on top and stay clickable.
  return [...byKey.values()].sort((a, b) => (b.mag ?? 0) - (a.mag ?? 0));
}

function matches(post: Post): boolean {
  if (state.show === "free" && !post.free) return false;
  if (state.show === "quakes" && post.section !== "Latest earthquakes") return false;
  if (state.show === "tectonics" && post.section === "Latest earthquakes") return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const where = whereOf(post);
  return [post.title, post.subtitle, where].some((s) => s.toLowerCase().includes(q));
}

function whereOf(post: Post): string {
  const data = state.data!;
  const e = post.events.map((id) => data.events[id]).filter(Boolean);
  if (e.length) return e.map((x) => x.place).filter((v, i, a) => a.indexOf(v) === i).join("; ");
  return post.place?.label ?? "";
}

// ---------- map ----------

function renderMap() {
  const data = state.data;
  if (!data || !state.land) return;
  const theme = readTheme(document.body);
  const css = getComputedStyle(document.body);
  const freeInk = css.getPropertyValue("--posts-free").trim();
  const paidInk = css.getPropertyValue("--posts-paid").trim();
  const plateInk = css.getPropertyValue("--posts-plate").trim();

  const visible = (p: Point) => p.posts.some(matches);
  const radius = (p: Point) => (p.mag === null ? 3.2 : 2 + Math.max(0, p.mag - 4) * 1.6);
  const fill = (p: Point) => (p.posts.some((x) => x.free) ? freeInk : paidInk);
  const sel = state.selected;

  const quakes = state.points.filter((p) => p.mag !== null);
  const places = state.points.filter((p) => p.mag === null);

  // The selected point's posts' context earthquakes, as hollow rings.
  const context: (QuakeEvent & { id: string })[] = [];
  if (sel) {
    for (const post of sel.posts) {
      for (const id of post.context) {
        const e = data.events[id];
        if (e && !context.some((c) => c.id === id)) context.push({ ...e, id });
      }
    }
  }

  const width = el.map.clientWidth || 800;
  const plot = Plot.plot({
    width,
    projection: worldProjection(),
    style: { background: "transparent", color: theme.text, fontSize: "11px" },
    marks: [
      Plot.geo({ type: "Sphere" } as never, { fill: theme.mapOcean, stroke: theme.mapCoast, strokeWidth: 0.6 }),
      Plot.graticule({ stroke: theme.mapCoast, strokeWidth: 0.4, strokeOpacity: 0.35 }),
      Plot.geo(state.land as never, { fill: theme.mapLand, stroke: theme.mapCoast, strokeWidth: 0.5 }),
      Plot.geo(state.plates as never, { stroke: plateInk, strokeWidth: 0.9, strokeOpacity: 0.75 }),
      Plot.dot(places, {
        x: "lon", y: "lat", r: radius, sort: null,
        stroke: fill, strokeWidth: 1.6, fill: theme.surface, fillOpacity: 0.85,
        strokeOpacity: (p: Point) => (visible(p) ? 1 : 0.15),
      }),
      Plot.dot(quakes, {
        x: "lon", y: "lat", r: radius, sort: null,
        fill, fillOpacity: (p: Point) => (visible(p) ? 0.85 : 0.12),
        stroke: theme.surface, strokeWidth: 0.6,
      }),
      Plot.dot(context, {
        x: "lon", y: "lat", r: (e: QuakeEvent) => 2 + Math.max(0, e.mag - 4) * 1.6,
        stroke: theme.text, strokeWidth: 1.2, strokeDasharray: "2,2", fill: "none",
      }),
      ...(sel ? [Plot.dot([sel], {
        x: "lon", y: "lat", r: (p: Point) => radius(p) + 3.5,
        stroke: theme.text, strokeWidth: 2, fill: "none",
      })] : []),
      Plot.tip(state.points.filter(visible), Plot.pointer({
        x: "lon", y: "lat", maxRadius: 20,
        fill: theme.surface, stroke: theme.axis, textPadding: 8, fontSize: 12, lineWidth: 34,
        title: (p: Point) => {
          const n = p.posts.length;
          const head = p.mag === null ? p.posts[0].title : p.label;
          return n === 1 && p.mag !== null ? `${head}\n${p.posts[0].title}` : `${head}\n${n === 1 ? "1 post" : `${n} posts`}`;
        },
      })),
    ],
  });

  // The tip's pointer sets plot.value to the circle under the cursor (or the
  // finger), so a click selects whatever the tip is showing.
  plot.addEventListener("click", () => {
    const p = (plot as unknown as { value: Point | null }).value;
    select(p && p !== state.selected ? p : null, false);
  });
  el.map.replaceChildren(plot);
}

// ---------- the selected circle ----------

function postCard(post: Post, withContext: boolean): string {
  const data = state.data!;
  const badge = post.free
    ? `<span class="posts-badge is-free">Free to read</span>`
    : `<span class="posts-badge">Subscribers</span>`;
  const cover = post.cover
    ? `<img class="posts-cover" src="${escapeHtml(post.cover)}" alt="" loading="lazy" />`
    : "";
  const context = withContext && post.context.length
    ? `<p class="posts-context">Also discusses: ${post.context
        .map((id) => data.events[id]).filter(Boolean)
        .map((e) => escapeHtml(eventLine(e))).join("; ")}</p>`
    : "";
  return `<a class="posts-card" data-track="posts-open" href="${SUBSTACK}${encodeURIComponent(post.slug)}"
             target="_blank" rel="noopener noreferrer">
      ${cover}
      <span class="posts-card-text">
        <span class="posts-card-meta">${fmtDate(post.date)} ${badge}</span>
        <span class="posts-card-title">${escapeHtml(post.title)}</span>
        ${post.subtitle ? `<span class="posts-card-sub">${escapeHtml(post.subtitle)}</span>` : ""}
      </span>
    </a>${context}`;
}

function renderSelected() {
  const p = state.selected;
  el.selected.hidden = !p;
  if (!p) { el.selected.replaceChildren(); return; }
  const posts = [...p.posts].sort((a, b) => a.date.localeCompare(b.date));
  const head = p.mag === null ? "" : `<h2 class="posts-selected-head">${escapeHtml(p.label)}</h2>`;
  const ctx = posts.some((x) => x.context.length)
    ? `<p class="chart-note">Dashed rings on the map are earlier earthquakes these posts compare it with.</p>` : "";
  el.selected.innerHTML = `${head}
    <div class="posts-selected-cards">${posts.map((x) => postCard(x, true)).join("")}</div>
    ${ctx}
    <button type="button" class="posts-clear" id="posts-clear">Clear selection</button>`;
  $("posts-clear").addEventListener("click", () => select(null, false));
}

function select(p: Point | null, scroll: boolean) {
  state.selected = p;
  renderMap();
  renderSelected();
  if (scroll && p) el.map.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- the list ----------

function renderList() {
  const data = state.data!;
  const shown = data.posts.filter(matches);
  const placed = new Set(state.points.flatMap((p) => p.posts.map((x) => x.slug)));
  el.count.textContent = shown.length === data.posts.length
    ? `${data.posts.length} posts since ${fmtDate(data.posts[data.posts.length - 1].date)}`
    : `${shown.length} of ${data.posts.length} posts`;

  const parts: string[] = [];
  let year = "";
  for (const post of shown) {
    const y = post.date.slice(0, 4);
    if (y !== year) { parts.push(`<h3 class="posts-year">${y}</h3>`); year = y; }
    const where = whereOf(post);
    const onMap = placed.has(post.slug)
      ? `<button type="button" class="posts-locate" data-slug="${escapeHtml(post.slug)}">On the map</button>`
      : "";
    parts.push(`<div class="posts-row">
        <span class="posts-row-date">${fmtDate(post.date).replace(/, \d{4}$/, "")}</span>
        <span class="posts-row-main">
          <a data-track="posts-open" href="${SUBSTACK}${encodeURIComponent(post.slug)}" target="_blank"
             rel="noopener noreferrer">${escapeHtml(post.title)}</a>${post.free ? ` <span class="posts-badge is-free">Free</span>` : ""}
          ${where ? `<span class="posts-row-where">${escapeHtml(where)}</span>` : ""}
        </span>
        ${onMap}
      </div>`);
  }
  el.list.innerHTML = parts.join("") || `<p class="chart-note">No posts match.</p>`;
}

el.list.addEventListener("click", (ev) => {
  const button = (ev.target as Element).closest<HTMLButtonElement>(".posts-locate");
  if (!button) return;
  const point = state.points.find((p) => p.posts.some((x) => x.slug === button.dataset.slug));
  if (point) select(point, true);
});

function refresh() {
  renderMap();
  renderList();
}

// ---------- start ----------

function buildShow() {
  const options: { id: Show; label: string }[] = [
    { id: "all", label: "All" },
    { id: "free", label: "Free to read now" },
    { id: "quakes", label: "Latest earthquakes" },
    { id: "tectonics", label: "Tectonics and more" },
  ];
  for (const o of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "segmented-option";
    b.textContent = o.label;
    b.setAttribute("aria-pressed", String(o.id === state.show));
    b.addEventListener("click", () => {
      state.show = o.id;
      for (const s of el.show.querySelectorAll("button")) s.setAttribute("aria-pressed", String(s === b));
      refresh();
    });
    el.show.append(b);
  }
}

function legend() {
  el.legend.innerHTML = `
    <span class="posts-key"><i class="posts-swatch is-free"></i>Free to read now</span>
    <span class="posts-key"><i class="posts-swatch"></i>For subscribers</span>
    <span class="posts-key"><i class="posts-swatch is-ring"></i>A region rather than one earthquake</span>
    <span class="posts-key"><i class="posts-swatch is-plate"></i>Plate boundary</span>
    <span class="posts-key posts-key-note">Larger circles, larger earthquakes</span>`;
}

async function start() {
  startAnalytics();
  buildShow();
  legend();
  const [data, land, plates] = await Promise.all([
    fetch(`${DATA_BASE}/posts.json`).then((r) => r.json() as Promise<Data>),
    loadLand(),
    fetch(`${DATA_BASE}/plates.json`).then((r) => r.json()),
  ]);
  state.data = data;
  state.land = land;
  state.plates = plates;
  state.points = buildPoints(data);
  el.generated.textContent = `Newest post: ${fmtDate(data.posts[0].date)}.`;
  refresh();

  let timer = 0;
  el.search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { state.query = el.search.value; refresh(); }, 120);
  });
  let lastWidth = el.map.clientWidth;
  new ResizeObserver(() => {
    if (el.map.clientWidth !== lastWidth) { lastWidth = el.map.clientWidth; renderMap(); }
  }).observe(el.map);
}

start().catch((err) => {
  console.error(err);
  el.map.innerHTML = `<p class="error">The posts could not be loaded. Try reloading the page.</p>`;
});
