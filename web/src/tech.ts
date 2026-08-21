/**
 * The technical summary at the foot of each page.
 *
 * Collapsed by default: it is provenance for anyone who wants it, not part of
 * the argument. Uses <details>, so it opens without JavaScript and is findable
 * by in-page search in browsers that look inside closed ones.
 *
 * The text is stored with **bold** lead-ins because each paragraph opens with
 * the thing it is about, and writing HTML into copy.ts would make the file
 * harder to edit by hand -- which is the whole point of that file.
 */
export function renderTech(title: string, body: string,
                           titleEl: HTMLElement, bodyEl: HTMLElement) {
  titleEl.textContent = title;
  bodyEl.replaceChildren(...body.split("\n\n").map((para) => {
    const p = document.createElement("p");
    // Split on the bold markers and alternate: even pieces are plain, odd are
    // strong. Built as nodes rather than innerHTML so the copy cannot inject
    // markup by accident.
    para.split("**").forEach((piece, i) => {
      if (!piece) return;
      if (i % 2 === 1) {
        const strong = document.createElement("strong");
        strong.textContent = piece;
        p.append(strong);
      } else {
        p.append(document.createTextNode(piece));
      }
    });
    return p;
  }));
}
