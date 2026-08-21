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
                   now: (string | null)[], headingText?: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "correlate-flip";
  // Column widths are set here rather than in the stylesheet because the two
  // kinds of table have different numbers of them.
  const template = columns
    .map((_, i) => (i === columns.length - 1 ? "minmax(0, 1fr)" : "minmax(0, 11rem)"))
    .join(" ");

  const title = document.createElement("p");
  title.className = "flip-title";
  title.textContent = headingText ?? copy.correlations.flipTitle;
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

  const row = (cells: (string | null)[], cls: string) => {
    const li = document.createElement("li");
    li.className = cls;
    li.style.gridTemplateColumns = template;
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
  columns.forEach((col) => head.append(heading(col)));
  list.append(head);
  rows.forEach((cells, i) => list.append(row(cells, i === current ? "is-current" : "")));
  // The readings sit in a row of their own, each under the threshold it is
  // being compared against. Anywhere else and the reader has to work out which
  // number goes with which column.
  list.append(row(now, "flip-reading"));

  box.append(list);
  return box;
}

