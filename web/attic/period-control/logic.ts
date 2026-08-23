const WINDOWS = [
  { id: "calendar", label: "This year" },
  { id: "rolling", label: "Last 365 days" },
] as const;


  window: document.getElementById("window-control")!,


  buildSegmented(el.window, WINDOWS.map((w) => ({ id: w.id, label: w.label })),
    () => state.window, (id) => {
      state.window = id as State["window"];
      // "2025" means the calendar year in one mode and August-to-August in the
      // other. Carrying a selection across would quietly point it elsewhere.
      state.highlights.clear();
      claimSlot(dayIndex(Date.now(), calendarShift()).year);
    });


function calendarShift(window: State["window"] = state.window): number {
  if (window === "calendar") return 0;
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
