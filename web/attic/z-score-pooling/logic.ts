interface SpreadCell {
  percentile: number;
}


/** One row per way of counting; one cell per time window. */
interface SpreadRow {
  label: string;
  cells: SpreadCell[];
}


/** Each value's rank among the others, itself excluded, ties counted as half. */
function leaveOneOutPercentiles(values: number[]): number[] {
  return values.map((v, i) => {
    let below = 0, tied = 0;
    values.forEach((o, j) => {
      if (j === i) return;
      if (o < v) below++;
      else if (o === v) tied++;
    });
    return (100 * (below + tied / 2)) / Math.max(1, values.length - 1);
  });
}


const SPREAD_WINDOWS: State["window"][] = ["rolling"];


function spreadTable(tier: Tier): { rows: SpreadRow[]; aggregate: Combined | null;
                                    years: number; columns: (Combined | null)[] } {
  const rows: SpreadRow[] = [];
  // One year -> percentile map per slicing. Keyed by year rather than indexed
  // by position: the rolling window shifts the year boundary, so its year list
  // is not the same length as the calendar one, and an earlier version quietly
  // dropped every rolling slicing on a length check -- averaging six where the
  // text beside it said twelve.
  const ranks: Map<number, number>[][] = SPREAD_WINDOWS.map(() => []);

  for (const minMag of MAGNITUDES) {
    for (const measure of ["count", "moment"] as Measure[]) {
      // Declustering is only offered on the count views, so the moment ones
      // have no aftershock choice to enumerate. Mirroring what the controls
      // can actually reach matters: a table listing combinations the page
      // cannot produce would not be a summary of this page.
      for (const mainshocksOnly of measure === "count" ? [false, true] : [false]) {
        const cells: SpreadCell[] = [];
        for (const [wi, window] of SPREAD_WINDOWS.entries()) {
          const shift = calendarShift();
          const curves = cumulativeByYear(
            tier, minMag, REFERENCE_START, mainshocksOnly, measure, shift);
          applyLive(curves, tier, minMag, shift, measure);
          const { year, day: today } = dayIndex(Date.now(), shift);
          const day = window === "rolling" ? DAYS - 1 : today;
          const refYears = curves.years.filter((y) => y >= REFERENCE_START && y < year);
          const result = verdict(curves, refYears, year, day, measure);
          if (!result) continue;

          // Kept per column, never merged across them. A shifted window labels
          // the 365 days ending today as year 2025, because that is where its
          // year boundary falls, while a calendar slicing means by 2025 the
          // whole of last year -- so pooling the two would put this year's
          // rolling total next to last year's completed one under one label.
          // Within a column every slicing shares a year boundary, so the six
          // there pool cleanly, and each column gets its own combined figure.
          const scored = curves.years.filter((y) => y >= REFERENCE_START && y <= year);
          const percentiles = leaveOneOutPercentiles(
            scored.map((y) => curves.curves.get(y)![day]));
          ranks[wi].push(new Map(scored.map((y, i) => [y, percentiles[i]])));

          cells.push({ percentile: result.percentile * 100 });
        }
        if (cells.length !== SPREAD_WINDOWS.length) continue;
        rows.push({
          label: fill(copy.home.spreadLabel, {
            threshold: magLabel(minMag),
            catalog: mainshocksOnly ? copy.home.spreadMainshocks : copy.home.spreadAll,
            measure: measure === "moment" ? copy.home.spreadMoment : copy.home.spreadCount,
          }),
          cells,
        });
      }
    }
  }

  // Only years every slicing scored, so the correlation between the tests is
  // measured over one common set of years.
  const pool = (rs: Map<number, number>[]) => {
    const shared = rs.length
      ? [...rs[0].keys()].filter((y) => rs.every((r) => r.has(y))).sort((a, b) => a - b)
      : [];
    return {
      combined: shared.length > 2
        ? combineRanks(rs.map((r) => shared.map((y) => r.get(y)!)))
        : null,
      years: shared.length - 1,
    };
  };
  const columns = ranks.map(pool);
  // The headline still comes off the calendar column: "so far this year" is
  // the question the page asks, and the rolling column answers a different one.
  return {
    rows,
    aggregate: columns[0].combined,
    years: columns[0].years,
    columns: columns.map((c) => c.combined),
  };
}


/**
 * The spread block -- the "Nth percentile, so far" sentence and the table of
 * ways of counting -- is parked in attic/spread-table. What is left is the
 * part nothing else could do without: the range quoted by the technical
 * summary, and the pooled score the hero histogram is drawn from.
 */
function writeSpread(spread: ReturnType<typeof spreadTable>, currentYear: number) {
  const { rows, aggregate } = spread;
  if (rows.length < 2) return;

  const all = rows.flatMap((r) => r.cells.map((cell) => cell.percentile));
  techValues.spreadLow = ordinal(Math.min(...all));
  techValues.spreadHigh = ordinal(Math.max(...all));
  if (aggregate) {
    techValues.ways = aggregate.tests;
    techValues.waysWord = numberWord(aggregate.tests);
    techValues.effective = aggregate.effective.toFixed(1);
    techValues.peers = aggregate.peers;
  }

  writeAggregateChart(spread, currentYear);
}


function writeAggregateChart(spread: ReturnType<typeof spreadTable>,
                             currentYear: number) {
  const a = spread.aggregate;
  if (!a || a.scores.length < 3) { el.answerAggregate.replaceChildren(); return; }

  const theme = readTheme(document.body);
  const width = Math.max(260, el.answerAggregate.clientWidth || 340);
  const scores = a.scores;
  const first = currentYear - (scores.length - 1);
  const peers = scores.slice(0, -1).map((value, i) => ({ year: first + i, value }));
  // Counted off the bars beside it, not from a.p, which is the fitted normal
  // tail. The label belongs to the picture, so it says how many years, not
  // what share: a percentage here reads as the complement of the percentile
  // above it and does not quite match, because one is a count of fifty bars
  // and the other is a smooth curve through them.

  const strip = renderDistribution({
    peers,
    value: a.z,
    share: {
      more: fill(copy.home.aggregateShareCount, { n: a.higher }),
      moreLabel: fill(copy.home.aggregateShareMore, { peers: a.peers }),
    },
    // Just the year. The percentile was on the marker as well as in the
    // sentence above the chart, which printed the same number twice.
    currentLabel: fill(copy.home.aggregateCurrent, { year: yearLabel(currentYear) }),
    theme, width,
  });

  const caption = document.createElement("p");
  caption.className = "answer-caption";
  caption.append(
    fill(copy.home.aggregateCaption, { from: first }),
    " ",
    hint(copy.home.aggregateHelp,
         fill(copy.home.aggregateHelpBody, { waysWord: numberWord(a.tests) })),
  );
  el.answerAggregate.replaceChildren(strip, caption);
}


  answerAggregate: document.getElementById("answer-aggregate")!,


// Only the parked histogram caption used this.
/** The page's question-mark tooltip, built as nodes rather than markup. */
function hint(label: string, body: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "hint";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hint-button";
  button.setAttribute("aria-label", label);
  button.textContent = "?";
  const tip = document.createElement("span");
  tip.className = "hint-tip";
  tip.setAttribute("role", "tooltip");
  // One <p> per paragraph. The tips written into the HTML use <br /><br />,
  // and .hint-tip has no white-space rule, so a body assigned with textContent
  // collapsed its blank lines and came out as one block of prose.
  for (const para of body.split("\n\n")) {
    const line = document.createElement("p");
    line.textContent = para;
    tip.append(line);
  }
  wrap.append(button, tip);

  // The tip is centred on the "?" in CSS, which is right for a caption in the
  // middle of the page. It is not enough on its own: a "?" close to either
  // margin still puts half a 22rem box past the edge. So on open, measure and
  // shift it back inside. Measuring happens in rAF because the tip is
  // display:none until :hover matches, and a rect taken too early is all zeros.
  const place = () => {
    tip.style.setProperty("--hint-nudge", "0px");
    requestAnimationFrame(() => {
      const r = tip.getBoundingClientRect();
      if (!r.width) return;
      const margin = 8;
      const over = r.right - (window.innerWidth - margin);
      const under = margin - r.left;
      const dx = over > 0 ? -over : under > 0 ? under : 0;
      if (dx) tip.style.setProperty("--hint-nudge", `${Math.round(dx)}px`);
    });
  };
  wrap.addEventListener("mouseenter", place);
  wrap.addEventListener("focusin", place);

  return wrap;
}
