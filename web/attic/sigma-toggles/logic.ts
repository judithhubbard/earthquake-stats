// src/main.ts -- constants
const RANGES = [
  { id: "percentile", label: "50 / 90%" },
  { id: "sigma", label: "±2σ (95.45%)" },
] as const;
const ANNUAL_SIGMA_LABEL = "±2σ (95.45%)";

// src/main.ts -- in `el`
  range: document.getElementById("range-control")!,
  annualRange: document.getElementById("annual-range-control")!,

// src/main.ts -- in buildControls()
  buildSegmented(el.range, RANGES.map((r) => ({ id: r.id, label: r.label })),
    () => state.range, (id) => { state.range = id as State["range"]; });
  buildToggle(el.annualRange, ANNUAL_SIGMA_LABEL,
    () => state.annualRange === "sigma",
    (on) => { state.annualRange = on ? "sigma" : "off"; });

// src/main.ts -- the one-button toggle the annual chart used; nothing else did
/** A single button that is either pressed or not, rather than a pair. */
function buildToggle(host: HTMLElement, label: string,
                     pressed: () => boolean, onToggle: (on: boolean) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "segmented-option";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(pressed()));
  button.addEventListener("click", () => {
    const next = !pressed();
    onToggle(next);
    button.setAttribute("aria-pressed", String(next));
    void update();
  });
  host.replaceChildren(button);
}

