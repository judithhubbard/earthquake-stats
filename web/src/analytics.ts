/**
 * GoatCounter, loaded only if a site code is set below.
 *
 * -------------------------------------------------------------------------
 * TO TURN THIS ON: put your GoatCounter code between the quotes.
 *
 * It is the first part of the address you get at signup. If your dashboard is
 * at https://quakes.goatcounter.com, the code is "quakes".
 *
 * Leave it empty and nothing loads at all -- no script, no request, no
 * third-party host. That is the state the site ships in.
 * -------------------------------------------------------------------------
 */
const SITE_CODE = "";

/** GoatCounter's collector. The only host this site talks to besides the USGS. */
const ENDPOINT = "//gc.zgo.at/count.js";

/**
 * Elements carrying data-track are counted as named events when clicked.
 *
 * Sent by hand rather than through GoatCounter's own data-goatcounter-click
 * attribute, because that one binds when its script loads and this script is
 * injected rather than parsed with the page.
 */
interface GoatCounter {
  count(vars: { path: string; title?: string; event?: boolean }): void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter & { no_onload?: boolean };
  }
}

export function startAnalytics() {
  if (!SITE_CODE) return;

  const script = document.createElement("script");
  script.async = true;
  script.dataset.goatcounter = `https://${SITE_CODE}.goatcounter.com/count`;
  script.src = ENDPOINT;
  document.head.append(script);

  // Delegated, so it works whatever order the script and the DOM settle in.
  document.addEventListener("click", (ev) => {
    const target = (ev.target as Element | null)?.closest<HTMLElement>("[data-track]");
    const name = target?.dataset.track;
    if (!name) return;
    window.goatcounter?.count({ path: name, title: name, event: true });
  });
}
