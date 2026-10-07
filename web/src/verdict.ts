/**
 * Hint popovers: the "?" buttons beside the controls.
 *
 * The verdict tables that used to live here went with the correlations page.
 */


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
