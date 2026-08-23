const DECADE = 10;

function writeDecades(counts: { year: number; count: number }[],
                      theme: ReturnType<typeof readTheme>) {
  el.decadeVerdict.replaceChildren();
  el.decadeChart.replaceChildren();
  if (counts.length < DECADE * 2) return;

  // Totals, not annual averages: the table beside this is in earthquakes, and
  // a reader should be able to find the same number in both.
  const windows = counts.map((_, i) => i)
    .filter((i) => i + DECADE <= counts.length)
    .map((i) => ({
      year: counts[i].year,
      value: counts.slice(i, i + DECADE).reduce((a, c) => a + c.count, 0),
    }));
  const now = windows[windows.length - 1];
  const past = windows.slice(0, -1);
  if (past.length < 3) return;

  const busier = past.filter((w) => w.value > now.value).length;
  let bandBar: HTMLElement | null = null;
  let bandBasis: HTMLElement | null = null;

  // The verdict rests on the exact test, not on the ranking above: the drawn
  // stretches overlap by nine years each, so their order describes where the
  // recent one sits and cannot be a p-value. Ten years is fixed in advance --
  // chosen after looking, fifteen would currently read a good deal smaller.
  const total = counts.reduce((a, c) => a + c.count, 0);
  const recent = counts.slice(-DECADE).reduce((a, c) => a + c.count, 0);
  const p = recentShareP(recent, total, DECADE / counts.length);
  if (p !== null) {
    const expected = total * (DECADE / counts.length);
    // The bands as counts, not probabilities: what a decade could hold before
    // the record would call it a change. Conditioning on the total makes this
    // the exact two-sample comparison, so the earlier years alone set the
    // ranges and their own rate being an estimate is already paid for.
    //
    // One cutoff, at 5%: the line the rest of the site grades on, and the one
    // that makes the middle band a 95% interval. A stricter 1% would widen it
    // to 854-993 and be slower to notice a change that was real.
    const bands = shareBands(total, DECADE / counts.length, [0.05]);
    if (!bands) return;
    const [band] = bands;
    techValues.decadeLow = band.low + 1;
    techValues.decadeHigh = band.high - 1;
    const key = p > 0.05 ? 1 : recent < expected ? 2 : 0;
    // Three rows in the table, five things the sentence can say. A two-sided p
    // above 0.5 is exactly the central half of what a steady rate produces, so
    // it is the honest line between "about the same" and "quiet side".
    const low = recent < expected;
    el.decadeVerdict.innerHTML =
      key !== 1 ? (low ? copy.home.decadeMaybeFewer : copy.home.decadeMaybeMore)
      : p > 0.5 ? copy.home.decadeUsual
      : low ? copy.home.decadeQuiet
      : copy.home.decadeBusy;
    el.decadeCheck.textContent = copy.home.decadeCheck;

    const c = copy.home;
    const earlier = total - recent;
    const earlierYears = counts.length - DECADE;
    el.decadeTable.replaceChildren(flipTable(
      [{ label: c.decadeColP,
         help: { label: c.decadeHelp,
                 body: fill(c.decadeHelpBody, {
                   rate: (earlier / earlierYears).toFixed(0),
                   expected: Math.round(expected).toLocaleString(),
                 }) } },
       { label: c.decadeColAnswer }],
      // Most at the top, fewest at the bottom, so the column runs the way a
      // count does rather than the way the bands were computed.
      [[fill(c.decadeBandMost, { n: band.high }), c.decadeAnsMore],
       [fill(c.decadeBandUsual, { lo: band.low + 1, hi: band.high - 1 }), c.decadeAnsNo],
       [fill(c.decadeBandFewest, { n: band.low }), c.decadeAnsFewer]],
      key,
      [fill(c.decadeNow, { value: String(recent) }), null],
      // Same order as the rows above, and the same three colours as the bar.
      ["up", "mid", "down"],
    ));

    // The same bar as the first question's, but on a count axis rather than a
    // percentile one. These three bands are 2.5 / 95 / 2.5 in probability, so
    // drawn to their probabilities the middle would swallow the whole bar and
    // a reader would learn nothing from it. Drawn to the counts they cover,
    // the marker's position means what it appears to mean.
    const values = [...past.map((w) => w.value), recent];
    const axisLo = Math.min(...values, band.low) - Math.max(1, (Math.max(...values, band.high) - Math.min(...values, band.low)) * 0.06);
    const axisHi = Math.max(...values, band.high) + Math.max(1, (Math.max(...values, band.high) - Math.min(...values, band.low)) * 0.06);
    bandBar = document.createElement("div");
    bandBar.className = "scale-bar";
    for (const [from, to, tint] of [
      [axisLo, band.low, "down"], [band.low, band.high, "mid"], [band.high, axisHi, "up"],
    ] as [number, number, string][]) {
      const seg = document.createElement("span");
      seg.className = `scale-seg scale-${tint}`;
      seg.style.flexGrow = String(Math.max(0.001, to - from));
      bandBar.append(seg);
    }
    const at = ((recent - axisLo) / (axisHi - axisLo)) * 100;
    const marker = document.createElement("span");
    marker.className = "scale-marker";
    marker.style.left = `${at}%`;
    const value = document.createElement("span");
    value.className = "scale-marker-value";
    value.textContent = String(recent);
    if (at > 90) value.classList.add("is-left");
    if (at < 10) value.classList.add("is-right");
    const tag = document.createElement("span");
    tag.className = "scale-marker-label";
    tag.textContent = `${now.year}\u2013${String(now.year + DECADE - 1).slice(2)}`;
    if (at > 80) tag.classList.add("is-left");
    marker.append(value, tag);
    bandBar.append(marker);

    bandBasis = document.createElement("p");
    bandBasis.className = "scale-basis";
    bandBasis.textContent = fill(copy.home.decadeBasis,
                                 { threshold: magLabel(MIN_MAGNITUDE) });
  }

  const strip = renderDistribution({
    peers: past,
    neutral: true,
    value: now.value,
    share: {
      more: fill(copy.home.decadeShareCount, { n: busier }),
      moreLabel: fill(copy.home.decadeShareMore, { peers: past.length }),
    },
    currentLabel: copy.home.decadeCurrent,
    yearLabel: (year: number) => `${year}\u2013${String(year + DECADE - 1).slice(2)}`,
    tickFormat: (n: number) => n.toFixed(0),
    theme,
    width: Math.max(260, el.decadeChart.clientWidth || 320),
  });

  const caption = document.createElement("p");
  caption.className = "answer-caption";
  caption.textContent = fill(copy.home.decadeCaption,
                             { threshold: magLabel(MIN_MAGNITUDE), from: REFERENCE_START });
  el.decadeChart.replaceChildren(
    ...[bandBar, bandBasis].filter((n): n is HTMLElement => n !== null), strip, caption);
}

/* ---- the render call, from lastRender() ---- */

    // The same chart with aftershocks removed. The second question needs the
    // declustered series -- one great earthquake can add a hundred events to a
    // year -- and showing both makes the difference the paragraph describes
    // something the reader can see rather than take on trust.
    el.rateChart.replaceChildren(renderAnnualChart({
      counts, highlights: annualHighlights, refYears: aRefYears,
      theme, width: widthOf(el.rateChart),
      yearLabel: (year: number) => yearLabel(year, "rolling"),
      showMajor: false,
      yLabel: "",
      title: fill(copy.home.axisAnnualMainshocks, { threshold: magLabel(MIN_MAGNITUDE) }),
      wholeNumbers: true,
      sigma: null,
      yMax: Math.max(0, ...counts.map((c) => Math.max(c.count, c.projected))),
    }));
