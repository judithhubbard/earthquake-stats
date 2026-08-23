/**
 * The verdict table: the rungs an answer can sit on, with the one in force
 * marked and the current readings underneath.
 *
 * Shared by the correlations panels, the page's own answer, and the trend
 * section on the front page, so all of them describe their rules the same way
 * and none can drift into describing a rule its page does not follow.
 */
import { copy } from "./copy";

export interface Column { label: string; help?: { label: string; body: string }; }

export function flipTable(columns: Column[], rows: string[][], current: number,
                   now: (string | null)[],
                   /* One tint class per row, keyed to the bar above the table.
                      Without them the bar's three colours are unexplained; the
                      other caller passes none and keeps its two columns. */
                   swatches?: (string | null)[]): HTMLElement {
  const box = document.createElement("div");
  box.className = "correlate-flip";
  // Column widths are set here rather than in the stylesheet because the two
  // kinds of table have different numbers of them.
  const template = (swatches ? "14px " : "") + columns
    .map((_, i) => (i === columns.length - 1 ? "minmax(0, 1fr)" : "minmax(0, 11rem)"))
    .join(" ");

  const title = document.createElement("p");
  title.className = "flip-title";
  title.textContent = copy.correlations.flipTitle;
  box.append(title);

  // Each statistic explains itself, in its own column heading, rather than one
  // tip on the title trying to cover both.
  const heading = (col: Column): HTMLElement => {
    const cell = document.createElement("span");
    cell.className = "flip-when";
    cell.textContent = col.label;
    if (col.help) {
      const hint = document.createElement("span");
      hint.className = "hint";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hint-button";
      button.setAttribute("aria-label", col.help.label);
      button.textContent = "?";
      const tip = document.createElement("span");
      tip.className = "hint-tip";
      tip.setAttribute("role", "tooltip");
      tip.textContent = col.help.body;
      hint.append(button, tip);
      cell.append(" ", hint);
    }
    return cell;
  };

  const list = document.createElement("ol");
  list.className = "flip-rows";

  const row = (cells: (string | null)[], cls: string, tint?: string | null) => {
    const li = document.createElement("li");
    li.className = cls;
    li.style.gridTemplateColumns = template;
    if (swatches) {
      const swatch = document.createElement("i");
      if (tint) swatch.className = `scale-seg scale-${tint}`;
      li.append(swatch);
    }
    cells.forEach((text, i) => {
      const cell = document.createElement("span");
      cell.className = i === cells.length - 1 ? "flip-says" : "flip-when";
      cell.textContent = text ?? "";
      li.append(cell);
    });
    return li;
  };

  const head = document.createElement("li");
  head.className = "flip-head";
  head.style.gridTemplateColumns = template;
  if (swatches) head.append(document.createElement("i"));
  columns.forEach((col) => head.append(heading(col)));
  list.append(head);
  rows.forEach((cells, i) =>
    list.append(row(cells, i === current ? "is-current" : "", swatches?.[i])));
  // The readings sit in a row of their own, each under the threshold it is
  // being compared against. Anywhere else and the reader has to work out which
  // number goes with which column.
  list.append(row(now, "flip-reading"));

  box.append(list);
  return box;
}


/**
 * Keeps any open hint inside the viewport.
 *
 * The tip is centred on its "?" and is 22rem wide, so a "?" near either edge
 * opens a box that runs off the page. This used to be handled in the helper
 * that built hints, which meant the hand-written ones in index.html -- the
 * control tooltips -- never got it, and the first control on the page opened
 * a box off the left edge.
 *
 * Measured on open rather than at build time: how much room there is depends
 * on where the element ended up and how wide the window is.
 */
export function installHintGuard(root: ParentNode = document): void {
  const MARGIN = 8;

  const place = (wrap: HTMLElement) => {
    const tip = wrap.querySelector<HTMLElement>(".hint-tip");
    if (!tip) return;
    wrap.style.setProperty("--hint-nudge", "0px");
    // After a frame, so the :hover rule that displays the tip has applied and
    // the box has a size to measure.
    requestAnimationFrame(() => {
      const box = tip.getBoundingClientRect();
      if (!box.width) return;
      let nudge = 0;
      if (box.left < MARGIN) nudge = MARGIN - box.left;
      else if (box.right > window.innerWidth - MARGIN) {
        nudge = window.innerWidth - MARGIN - box.right;
      }
      wrap.style.setProperty("--hint-nudge", `${Math.round(nudge)}px`);
    });
  };

  const onOpen = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const wrap = target?.closest?.(".hint") as HTMLElement | null;
    if (wrap) place(wrap);
  };

  root.addEventListener("pointerover", onOpen, true);
  root.addEventListener("focusin", onOpen, true);
}
