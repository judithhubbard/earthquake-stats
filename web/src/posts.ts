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
import { CENTRE_LON, loadLand, loadDetailedLand, worldProjection } from "./map";
import { startAnalytics } from "./analytics";

interface Post {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  free: boolean;
  section: string;
  /** A review of a published paper (tagged on Substack). */
  review: boolean;
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

type Show = "all" | "free" | "reviews";
type Mode = "map" | "globe";

const SUBSTACK = "https://earthquakeinsights.substack.com/p/";
/** A post this new is marked on the map and in the list: its free month. */
const RECENT_MS = 30 * 864e5;
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
  tip: $<HTMLDivElement>("posts-tip"),
};

const state = {
  data: null as Data | null,
  points: [] as Point[],
  land: null as unknown,
  plates: null as unknown,
  selected: null as Point | null,
  mode: "map" as Mode,
  /** The flat world map's central meridian; dragging the world view moves it. */
  centre: CENTRE_LON,
  /** Zoom: k = 1 is the whole world (or hemisphere, on the globe); lon/lat is
   *  the centre of the view. */
  view: { k: 1, lon: CENTRE_LON, lat: 0 },
  /** The world map's height, held while zoomed so the frame does not jump. */
  height: 0,
  detailedLand: null as unknown,
  query: "",
  show: "all" as Show,
};

// ---------- formatting ----------

// One formatter, made once: toLocaleDateString builds a new one on every call,
// and with a thousand dates on the page that alone took seconds.
const DATE_FMT = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (ms: number | string) => DATE_FMT.format(new Date(ms));

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const isRecent = (post: Post) => Date.now() - Date.parse(post.date) < RECENT_MS;

/** A circle's posts, newest first. */
const newestFirst = (p: Point) => [...p.posts].sort((a, b) => b.date.localeCompare(a.date));

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
  if (state.show === "reviews" && !post.review) return false;
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

// ---------- zoom ----------

const MAX_K = 32;
/** Above this, the 1:110m coastlines are visibly crude; switch to 1:50m. */
const DETAIL_K = 3;

/** Half the view's width and height, in degrees. */
function halfSpan() {
  const width = el.map.clientWidth || 800;
  const w = 180 / state.view.k;
  return { w, h: (w * (state.height || width / 2)) / width };
}

/**
 * Zoomed, the projection is re-centred on the view, so whatever is in the
 * middle is drawn with Equal Earth's least distortion -- Turkey, at 40°E,
 * would be badly sheared on a map still centred on 170°E. The view is fitted
 * to a grid of points rather than a polygon: d3 reads a polygon's inside from
 * its winding, which is how a box once covered the whole sphere (see map.ts).
 */
function projection() {
  const { k, lon, lat } = state.view;
  if (state.mode === "globe") return globeProjection();
  if (k <= 1.001) return worldProjection(state.centre);
  const { w, h } = halfSpan();
  const coordinates: [number, number][] = [];
  for (const fx of [-1, -0.5, 0, 0.5, 1]) {
    for (const fy of [-1, 0, 1]) coordinates.push([lon + fx * w, lat + fy * h]);
  }
  return { type: "equal-earth" as never, rotate: [-lon, 0] as [number, number],
           domain: { type: "MultiPoint", coordinates } as never };
}

/**
 * The globe: orthographic, turned to face the view's centre. Zooming fits a
 * smaller cap of the sphere -- a ring of points 90/k degrees out -- to the
 * frame, which keeps Plot's own fitting and the far side's clipping.
 */
function globeProjection() {
  const { k, lon, lat } = state.view;
  const r = (Math.PI / 2) / k;
  const φ0 = (lat * Math.PI) / 180, λ0 = (lon * Math.PI) / 180;
  const coordinates: [number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const θ = (i / 24) * 2 * Math.PI;
    const φ = Math.asin(Math.sin(φ0) * Math.cos(r) + Math.cos(φ0) * Math.sin(r) * Math.cos(θ));
    const λ = λ0 + Math.atan2(Math.sin(θ) * Math.sin(r) * Math.cos(φ0), Math.cos(r) - Math.sin(φ0) * Math.sin(φ));
    coordinates.push([(λ * 180) / Math.PI, (φ * 180) / Math.PI]);
  }
  return { type: "orthographic" as never, rotate: [-lon, -lat] as [number, number],
           domain: k <= 1.001 ? ({ type: "Sphere" } as never) : ({ type: "MultiPoint", coordinates } as never) };
}

/** The globe's height: square, but no taller than most screens. */
const globeHeight = () => Math.min(el.map.clientWidth || 800, 620);

function clampView() {
  const v = state.view;
  v.k = Math.min(MAX_K, Math.max(1, v.k));
  if (state.mode === "globe") {
    v.lat = Math.min(89, Math.max(-89, v.lat));
    v.lon = ((v.lon + 540) % 360) - 180;
    return;
  }
  if (v.k <= 1.001) { v.k = 1; v.lon = state.centre; v.lat = 0; return; }
  const { h } = halfSpan();
  v.lat = Math.min(85 - h, Math.max(-78 + h, v.lat));
  if (85 - h < -78 + h) v.lat = 0;
  v.lon = ((v.lon + 540) % 360) - 180;
}

/** Degrees under a pixel offset from the map's centre (near enough for zooming). */
function offsetToDegrees(dx: number, dy: number) {
  if (state.mode === "globe") {
    // Near the middle of the globe, a pixel is 1/R radians, R the drawn radius.
    const deg = 180 / Math.PI / ((globeHeight() / 2) * state.view.k);
    return { dLon: (dx * deg) / Math.cos((state.view.lat * Math.PI) / 180), dLat: -dy * deg };
  }
  const width = el.map.clientWidth || 800;
  const height = state.height || width / 2;
  const { w, h } = halfSpan();
  return { dLon: (dx / width) * 2 * w, dLat: (-dy / height) * 2 * h };
}

/** Zoom by a factor, keeping the point at pixel offset (dx, dy) from the centre fixed. */
function zoomBy(factor: number, dx = 0, dy = 0) {
  const before = offsetToDegrees(dx, dy);
  const anchor = { lon: state.view.lon + before.dLon, lat: state.view.lat + before.dLat };
  const k0 = state.view.k;
  state.view.k = Math.min(MAX_K, Math.max(1, k0 * factor));
  const ratio = k0 / state.view.k;
  state.view.lon = anchor.lon - before.dLon * ratio;
  state.view.lat = anchor.lat - before.dLat * ratio;
  clampView();
  scheduleRender();
}

function zoomTo(lon: number, lat: number, k: number) {
  state.view = { k, lon, lat };
  clampView();
  renderMap();
}

let frame = 0;
function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; renderMap(); });
}

/** Set by a drag, so the click that ends it does not select a circle. */
let dragged = false;

function wireMode() {
  const box = $("posts-mode");
  for (const [mode, label] of [["map", "Map"], ["globe", "Globe"]] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-pressed", String(state.mode === mode));
    b.addEventListener("click", () => {
      if (state.mode === mode) return;
      // Keep the reader's place: the globe faces whatever the map was centred
      // on, and back on the map the world view is centred where the globe was.
      const { lon, lat, k } = state.view;
      state.mode = mode;
      if (mode === "globe") state.view = { k: Math.max(1, k / 2), lon, lat: k > 1 ? lat : 20 };
      else { state.centre = lon; state.view = { k: 1, lon, lat: 0 }; }
      clampView();
      for (const x of box.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
      renderMap();
    });
    box.append(b);
  }
}

function wireZoom() {
  $("zoom-in").addEventListener("click", () => zoomBy(2));
  $("zoom-out").addEventListener("click", () => zoomBy(0.5));
  $("zoom-reset").addEventListener("click", () => zoomTo(state.view.lon, state.mode === "globe" ? state.view.lat : 0, 1));

  const centreOffset = (x: number, y: number) => {
    const r = el.map.getBoundingClientRect();
    return { dx: x - r.left - r.width / 2, dy: y - r.top - r.height / 2 };
  };

  el.map.addEventListener("dblclick", (ev) => {
    ev.preventDefault();
    const { dx, dy } = centreOffset(ev.clientX, ev.clientY);
    zoomBy(ev.shiftKey ? 0.5 : 2, dx, dy);
  });

  // The wheel zooms. A trackpad pinch arrives as a wheel event with ctrlKey
  // set and small deltas, so it gets a stronger rate than a mouse notch
  // (deltaY ~100, about 1.2x a notch). At the whole-world view, scrolling down
  // -- zooming out -- is left to the page, so a reader scrolling past the map
  // is not caught by it; only scrolling up over the map starts a zoom.
  el.map.addEventListener("wheel", (ev) => {
    const delta = ev.deltaY * (ev.deltaMode === 1 ? 33 : ev.deltaMode === 2 ? 400 : 1);
    if (state.view.k <= 1 && delta > 0) return;
    ev.preventDefault();
    const { dx, dy } = centreOffset(ev.clientX, ev.clientY);
    zoomBy(Math.exp(-delta * (ev.ctrlKey ? 0.01 : 0.002)), dx, dy);
  }, { passive: false });

  // Drag to pan, two fingers to pinch.
  const pointers = new Map<number, { x: number; y: number }>();
  let startX = 0, startY = 0, pinch = 0;
  el.map.addEventListener("pointerdown", (ev) => {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) { startX = ev.clientX; startY = ev.clientY; dragged = false; }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  el.map.addEventListener("pointermove", (ev) => {
    const last = pointers.get(ev.pointerId);
    if (!last) return;
    const now = { x: ev.clientX, y: ev.clientY };
    pointers.set(ev.pointerId, now);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) {
        const { dx, dy } = centreOffset((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomBy(d / pinch, dx, dy);
      }
      pinch = d;
      dragged = true;
      return;
    }
    if (!dragged && Math.hypot(now.x - startX, now.y - startY) < 4) return;
    dragged = true;
    el.map.setPointerCapture(ev.pointerId);
    if (state.mode === "map" && state.view.k <= 1) {
      // The whole flat map: a sideways drag slides the central meridian.
      const width = el.map.clientWidth || 800;
      state.centre = ((state.centre - ((now.x - last.x) / width) * 360 + 540) % 360) - 180;
      state.view.lon = state.centre;
      scheduleRender();
      return;
    }
    const { dLon, dLat } = offsetToDegrees(now.x - last.x, now.y - last.y);
    state.view.lon -= dLon;
    state.view.lat -= dLat;
    clampView();
    scheduleRender();
  });
  const end = (ev: PointerEvent) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = 0;
  };
  el.map.addEventListener("pointerup", end);
  el.map.addEventListener("pointercancel", end);
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
  const recent = state.points.filter((p) => visible(p) && p.posts.some(isRecent));

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
  const zoomed = state.view.k > 1;
  if (zoomed && state.view.k >= DETAIL_K && !state.detailedLand) {
    void loadDetailedLand().then((land) => { state.detailedLand = land; scheduleRender(); });
  }
  const land = zoomed && state.view.k >= DETAIL_K && state.detailedLand ? state.detailedLand : state.land;
  const plot = Plot.plot({
    width,
    ...(state.mode === "globe" ? { height: globeHeight() } : zoomed ? { height: state.height } : {}),
    projection: projection(),
    style: { background: "transparent", color: theme.text, fontSize: "11px" },
    marks: [
      Plot.geo({ type: "Sphere" } as never, { fill: theme.mapOcean, stroke: theme.mapCoast, strokeWidth: 0.6 }),
      Plot.graticule({ stroke: theme.mapCoast, strokeWidth: 0.4, strokeOpacity: 0.35 }),
      Plot.geo(land as never, { fill: theme.mapLand, stroke: theme.mapCoast, strokeWidth: 0.5 }),
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
      // Recent posts: a solid ring, and a second one that pulses outward.
      Plot.dot(recent, {
        x: "lon", y: "lat", r: (p: Point) => radius(p) + 3, sort: null,
        stroke: freeInk, strokeWidth: 1.6, fill: "none",
      }),
      Plot.dot(recent, {
        x: "lon", y: "lat", r: (p: Point) => radius(p) + 3, sort: null,
        stroke: freeInk, strokeWidth: 1.6, fill: "none", className: "posts-pulse",
      }),
      Plot.dot(context, {
        x: "lon", y: "lat", r: (e: QuakeEvent) => 2 + Math.max(0, e.mag - 4) * 1.6,
        stroke: theme.text, strokeWidth: 1.2, strokeDasharray: "2,2", fill: "none",
      }),
      ...(sel ? [Plot.dot([sel], {
        x: "lon", y: "lat", r: (p: Point) => radius(p) + 3.5,
        stroke: theme.text, strokeWidth: 2, fill: "none",
      })] : []),
      // Invisible: it only finds the circle under the cursor, for the HTML tip
      // (which can show the post's cover image) and for clicks.
      Plot.dot(state.points.filter(visible), Plot.pointer({
        x: "lon", y: "lat", r: radius, maxRadius: 20, fill: "none", stroke: "none",
      })),
    ],
  });

  // The pointer sets plot.value to the circle under the cursor (or the
  // finger), so a click selects whatever the tip is showing.
  plot.addEventListener("input", () => showTip((plot as unknown as { value: Point | null }).value));
  plot.addEventListener("click", () => {
    if (dragged) { dragged = false; return; }
    const p = (plot as unknown as { value: Point | null }).value;
    select(p && p !== state.selected ? p : null, false);
  });
  if (!zoomed && state.mode === "map") state.height = Number(plot.getAttribute("height")) || state.height;
  $("zoom-reset").hidden = !zoomed;
  ($("zoom-out") as HTMLButtonElement).disabled = !zoomed;
  ($("zoom-in") as HTMLButtonElement).disabled = state.view.k >= MAX_K;
  el.map.classList.toggle("is-zoomed", zoomed);
  el.map.classList.toggle("is-globe", state.mode === "globe");
  el.map.replaceChildren(plot);
}

// ---------- the hover tip ----------

let tipPoint: Point | null = null;
const cursor = { x: 0, y: 0 };

function showTip(p: Point | null) {
  if (p === tipPoint) return;
  tipPoint = p;
  if (!p || dragged) { el.tip.hidden = true; return; }
  const posts = newestFirst(p);
  const post = posts[0];
  const cover = post.cover ? `<img src="${escapeHtml(post.cover)}" alt="" />` : "";
  const isNew = isRecent(post) ? `<span class="posts-badge is-new">New</span>` : "";
  const more = posts.length > 1 ? `<span class="posts-tip-more">+ ${posts.length - 1} more ${posts.length === 2 ? "post" : "posts"}</span>` : "";
  el.tip.innerHTML = `${cover}
    <span class="posts-tip-text">
      ${p.label ? `<span class="posts-tip-where">${escapeHtml(p.label.replace(/ · [^·]*$/, ""))}</span>` : ""}
      <span class="posts-tip-title">${escapeHtml(post.title)}</span>
      <span class="posts-card-meta">${fmtDate(post.date)}${isNew}</span>
      ${more}
    </span>`;
  el.tip.hidden = false;
  placeTip();
}

/** Beside the cursor, flipped left or up where it would run off the map. */
function placeTip() {
  if (el.tip.hidden) return;
  const wrap = el.tip.parentElement!.getBoundingClientRect();
  const w = el.tip.offsetWidth, h = el.tip.offsetHeight, gap = 16;
  let x = cursor.x + gap, y = cursor.y - h / 2;
  if (x + w > wrap.width) x = cursor.x - gap - w;
  x = Math.max(0, x);
  y = Math.min(Math.max(0, y), wrap.height - h);
  el.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function wireTip() {
  el.map.addEventListener("pointermove", (ev) => {
    const wrap = el.tip.parentElement!.getBoundingClientRect();
    cursor.x = ev.clientX - wrap.left;
    cursor.y = ev.clientY - wrap.top;
    if (dragged) el.tip.hidden = true;
    else placeTip();
  });
  el.map.addEventListener("pointerleave", () => { tipPoint = null; el.tip.hidden = true; });
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
  // From the list, fly to it; a circle clicked on the map is already in view.
  if (scroll && p) zoomTo(p.lon, p.lat, Math.max(state.view.k, p.mag === null ? 6 : 8));
  else renderMap();
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
             rel="noopener noreferrer">${escapeHtml(post.title)}</a>${isRecent(post) ? ` <span class="posts-badge is-new">New</span>` : ""}${post.free ? ` <span class="posts-badge is-free">Free</span>` : ""}
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
    { id: "reviews", label: "Paper reviews" },
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
    <span class="posts-key"><i class="posts-swatch is-new"></i>Posted in the last 30 days</span>
    <span class="posts-key"><i class="posts-swatch is-ring"></i>A region rather than one earthquake</span>
    <span class="posts-key"><i class="posts-swatch is-plate"></i>Plate boundary</span>
    <span class="posts-key posts-key-note">Larger circles, larger earthquakes</span>`;
}

async function start() {
  startAnalytics();
  wireZoom();
  wireMode();
  wireTip();
  buildShow();
  legend();
  const [data, land, plates] = await Promise.all([
    // no-cache: revalidate every load, or a paywall change made on Substack
    // can sit behind GitHub Pages' ten-minute browser cache.
    fetch(`${DATA_BASE}/posts.json`, { cache: "no-cache" }).then((r) => r.json() as Promise<Data>),
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
    if (el.map.clientWidth !== lastWidth) {
      lastWidth = el.map.clientWidth;
      // The held height belongs to the old width; re-measure from the world view.
      const view = state.view;
      state.view = { k: 1, lon: state.centre, lat: 0 };
      if (state.mode === "map") renderMap();
      state.view = view;
      if (view.k > 1 || state.mode === "globe") renderMap();
    }
  }).observe(el.map);
}

start().catch((err) => {
  console.error(err);
  el.map.innerHTML = `<p class="error">The posts could not be loaded. Try reloading the page.</p>`;
});
