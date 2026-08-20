import * as Plot from "@observablehq/plot";
import { DATA_BASE } from "./catalog";
import { readTheme, type Theme } from "./chart";
import { copy, fill } from "./copy";

const C = copy.aftershocks;

interface StackPoint { day: number; rate: number; }
interface DecayPoint { days: number; rate: number; count: number; }
interface Example {
  id: string; kind: string; place: string; mag: number; time: number;
  foreshocks: number; series: { day: number; count: number }[];
}
interface Sequences {
  minMagnitude: number; anchorMagnitude: number; radiusKm: number;
  anchors: number; foreshockDays: number; foreshockKm: number; exampleRadiusKm: number;
  stack: StackPoint[]; decay: DecayPoint[];
  omori: { p: number; intercept: number };
  foreshocks: { any: number; half: number; full: number; total: number };
  examples: Example[];
}

const el = {
  answer: document.getElementById("answer")!,
  answerDetail: document.getElementById("answer-detail")!,
  panels: document.getElementById("panels")!,
  method: document.getElementById("method")!,
};

let theme: Theme;
const redraw: (() => void)[] = [];

function panel(question: string, verdict: string, explain: string, subtitle: string,
               draw: (width: number) => SVGSVGElement | HTMLElement): HTMLElement {
  const section = document.createElement("figure");
  section.className = "chart correlate-panel";

  const heading = document.createElement("figcaption");
  heading.className = "correlate-question";
  heading.textContent = question;

  const answer = document.createElement("p");
  answer.className = "correlate-verdict";
  answer.textContent = verdict;

  const body = document.createElement("p");
  body.className = "correlate-explain";
  body.textContent = explain;

  const sub = document.createElement("p");
  sub.className = "correlate-subtitle";
  sub.textContent = subtitle;

  const host = document.createElement("div");
  host.className = "correlate-chart";

  section.append(heading, answer, body, sub, host);
  redraw.push(() => {
    const width = Math.max(320, host.clientWidth || 760);
    host.replaceChildren(draw(width));
  });
  return section;
}

/**
 * The stack, on a logarithmic vertical scale.
 *
 * The day-of value is roughly 170 times the background. On a linear scale that
 * single bar is the whole chart and everything either side of it is a flat line
 * on the axis -- which hides the two things worth seeing, the slow rise
 * beforehand and the long tail after.
 */
function stackChart(data: Sequences, width: number): SVGSVGElement | HTMLElement {
  const points = data.stack.filter((d) => d.rate > 0);
  return Plot.plot({
    width,
    height: Math.max(230, Math.min(300, width * 0.34)),
    marginLeft: 70, marginRight: 16, marginBottom: 40, marginTop: 16,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    x: { label: "Days before and after", labelAnchor: "center", grid: true },
    y: {
      type: "log", label: C.stackAxis, labelAnchor: "center", labelOffset: 56,
      grid: true, labelArrow: null,
    },
    color: { type: "identity" },
    marks: [
      Plot.ruleX([0], { stroke: theme.up, strokeWidth: 1.5, strokeOpacity: 0.6 }),
      Plot.text([{ x: 0, label: C.stackMarker }], {
        x: "x", text: "label", frameAnchor: "top", dy: 1, dx: 4,
        textAnchor: "start", fill: theme.up, fontSize: 11, fontWeight: 600,
      }),
      Plot.line(points, {
        x: "day", y: "rate", stroke: theme.series[0], strokeWidth: 2, curve: "monotone-x",
      }),
      Plot.dot(points, {
        x: "day", y: "rate", r: 2.6,
        fill: theme.series[0], stroke: theme.surface, strokeWidth: 0.6,
      }),
      Plot.tip(points, Plot.pointerX({
        x: "day", y: "rate",
        fill: theme.surface, stroke: theme.axis, textPadding: 12, fontSize: 16,
        title: (d: StackPoint) =>
          `${d.day === 0 ? "the day itself" : d.day > 0 ? `${d.day} days after` : `${-d.day} days before`}` +
          `\n${d.rate.toFixed(d.rate < 1 ? 3 : 2)} earthquakes per day`,
      })),
    ],
  });
}

/** Omori's law: on log-log, one-over-time is a straight line of slope −1. */
function decayChart(data: Sequences, width: number): SVGSVGElement | HTMLElement {
  const first = data.decay[0];
  const reference = [0.01, 100].map((days) => ({
    days, rate: first.rate * (first.days / days),
  }));
  return Plot.plot({
    width,
    height: Math.max(230, Math.min(300, width * 0.34)),
    marginLeft: 70, marginRight: 16, marginBottom: 44, marginTop: 16,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    x: { type: "log", label: C.decayAxisX, labelAnchor: "center", grid: true, labelArrow: null },
    y: {
      type: "log", label: C.decayAxisY, labelAnchor: "center", labelOffset: 56,
      grid: true, labelArrow: null,
    },
    color: { type: "identity" },
    marks: [
      Plot.line(reference, {
        x: "days", y: "rate",
        stroke: theme.muted, strokeWidth: 1.5, strokeDasharray: "5,4",
      }),
      Plot.text([reference[1]], {
        x: "days", y: "rate", text: () => C.decayReference,
        dy: -10, dx: -4, textAnchor: "end", fill: theme.muted, fontSize: 11,
      }),
      Plot.line(data.decay, {
        x: "days", y: "rate", stroke: theme.series[0], strokeWidth: 2,
      }),
      Plot.dot(data.decay, {
        x: "days", y: "rate", r: 3,
        fill: theme.series[0], stroke: theme.surface, strokeWidth: 0.6,
      }),
      Plot.tip(data.decay, Plot.pointerX({
        x: "days", y: "rate",
        fill: theme.surface, stroke: theme.axis, textPadding: 12, fontSize: 16,
        title: (d: DecayPoint) =>
          `${d.days < 1 ? `${(d.days * 24).toFixed(1)} hours` : `${d.days.toFixed(1)} days`} after` +
          `\n${d.rate.toFixed(d.rate < 1 ? 3 : 1)} per day`,
      })),
    ],
  });
}

/** Two named sequences, drawn on one shared scale so they can be compared. */
function examplesChart(data: Sequences, width: number): SVGSVGElement | HTMLElement {
  const rows = data.examples.flatMap((e) =>
    e.series.map((s) => ({
      ...s,
      panel: fill(C.exampleWith, { mag: `M${e.mag.toFixed(1)}`, place: shortPlace(e.place) }),
    })));
  return Plot.plot({
    width,
    height: Math.max(260, Math.min(340, width * 0.38)),
    marginLeft: 70, marginRight: 16, marginBottom: 40, marginTop: 24,
    style: { background: "transparent", color: theme.text, fontSize: "12px" },
    facet: { data: rows, y: "panel", marginRight: 4 },
    fy: { label: null },
    x: { label: "Days before and after", labelAnchor: "center", grid: true },
    y: { label: C.examplesAxis, labelAnchor: "center", labelOffset: 56, grid: true, labelArrow: null },
    color: { type: "identity" },
    marks: [
      Plot.ruleX([0], { stroke: theme.up, strokeWidth: 1.2, strokeOpacity: 0.5 }),
      Plot.rectY(rows, {
        x: "day", y: "count",
        fill: (d: { day: number }) => (d.day < 0 ? theme.up : theme.series[0]),
        fillOpacity: 0.85, inset: 0.4,
      }),
      Plot.ruleY([0], { stroke: theme.axis }),
      Plot.tip(rows, Plot.pointerX({
        x: "day", y: "count",
        fill: theme.surface, stroke: theme.axis, textPadding: 12, fontSize: 16,
        title: (d: { day: number; count: number }) =>
          `${d.day === 0 ? "the day itself" : d.day > 0 ? `${d.day} days after` : `${-d.day} days before`}` +
          `\n${d.count} earthquakes`,
      })),
    ],
  });
}

/** ComCat place strings carry a year and the word "Earthquake"; the chart has room for neither. */
function shortPlace(place: string): string {
  return place.replace(/^\d{4}\s+/, "").replace(/\s+Earthquake$/i, "").split(" - ")[0];
}

async function boot() {
  let data: Sequences;
  try {
    const res = await fetch(`${DATA_BASE}/sequences.json`);
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch (err) {
    el.answer.textContent = C.errorLoad;
    el.answerDetail.textContent = (err as Error).message;
    return;
  }

  theme = readTheme(document.body);
  const background = data.stack.find((d) => d.day === -30)?.rate ?? 0;
  const peak = data.stack.find((d) => d.day === 0)?.rate ?? 0;

  el.answer.innerHTML = C.answer;
  el.answerDetail.textContent = C.detail;

  const panels = [
    panel(C.stackQuestion, C.stackVerdict,
      fill(C.stackExplain, {
        anchors: data.anchors,
        // A rate below one reads badly as "0.05 earthquakes"; the interval it
        // implies is the same fact in a form people can picture.
        backgroundPeriod: Math.round(1 / Math.max(background, 1e-9) / 7),
        peak: peak.toFixed(1),
      }),
      fill(C.stackSubtitle, { radius: data.radiusKm, days: 30 }),
      (w) => stackChart(data, w)),

    panel(C.decayQuestion, C.decayVerdict,
      fill(C.decayExplain, { p: data.omori.p.toFixed(2) }),
      C.decaySubtitle,
      (w) => decayChart(data, w)),

    panel(C.examplesQuestion, C.examplesVerdict,
      fill(C.examplesExplain, {
        half: data.foreshocks.half, rest: (100 - data.foreshocks.half).toFixed(0),
      }),
      fill(C.examplesSubtitle, { radius: data.exampleRadiusKm, days: 30 }),
      (w) => examplesChart(data, w)),
  ];

  el.panels.replaceChildren(...panels);
  for (const fn of redraw) fn();

  el.method.textContent = fill(C.method, {
    minMagnitude: data.minMagnitude, radius: data.radiusKm,
    anchorMagnitude: data.anchorMagnitude,
    foreshockDays: data.foreshockDays, foreshockKm: data.foreshockKm,
  });
}

let resizeTimer: number | undefined;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { for (const fn of redraw) fn(); }, 150);
});
void boot();
