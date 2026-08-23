const MEASURES = [
  { id: "count", label: "Count" },
  { id: "moment", label: "Moment" },
] as const;


  measure: document.getElementById("measure-control")!,


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


  buildSegmented(el.measure, MEASURES.map((m) => ({ id: m.id, label: m.label })),
    () => state.measure, (id) => {
      state.measure = id as Measure;
      syncControlAvailability();
    });
