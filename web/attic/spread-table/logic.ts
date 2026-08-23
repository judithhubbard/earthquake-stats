function writeSpread(spread: ReturnType<typeof spreadTable>, currentYear: number) {
  const { rows, aggregate } = spread;
  if (rows.length < 2) { el.spread.hidden = true; return; }
  el.spread.hidden = false;

  const c = copy.home;
  const all = rows.flatMap((r) => r.cells.map((cell) => cell.percentile));
  techValues.spreadLow = ordinal(Math.min(...all));
  techValues.spreadHigh = ordinal(Math.max(...all));
  el.spreadAggregate.replaceChildren();
  if (aggregate) {
    techValues.ways = aggregate.tests;
    techValues.waysWord = numberWord(aggregate.tests);
    techValues.effective = aggregate.effective.toFixed(1);
    techValues.peers = aggregate.peers;
    // No tooltip. It walked through Stouffer, the divisor and the ranking --
    // all of which the technical summary now says, and says better -- while
    // its live numbers, the six percentiles and this year's score, are in the
    // table underneath and the histogram above.
    el.spreadAggregate.append(fill(c.spreadAggregate, {
      year: yearLabel(currentYear),
      percentile: ordinal(100 * (1 - aggregate.p)),
    }));
  }

  writeAggregateChart(spread, currentYear);

  const box = document.createElement("div");
  box.className = "correlate-flip spread-box";
  const list = document.createElement("ol");
  list.className = "flip-rows";
  const template = "minmax(0, 1fr) minmax(0, 7.5rem) minmax(0, 7.5rem)";

  const row = (cells: string[], cls: string) => {
    const li = document.createElement("li");
    li.className = cls;
    li.style.gridTemplateColumns = template;
    cells.forEach((text, i) => {
      const cell = document.createElement("span");
      cell.className = i === 0 ? "flip-when" : "flip-when flip-num";
      cell.textContent = text;
      li.append(cell);
    });
    return li;
  };

  list.append(row([c.spreadColWay, c.spreadCalendar, c.spreadRolling], "flip-head"));
  for (const r of rows) {
    list.append(row(
      [r.label, ...r.cells.map((cell) => ordinal(cell.percentile))], ""));
  }
  // The same figure the headline quotes, one per column -- not the mean of the
  // rows above it. A plain mean would treat six slicings that correlate at up
  // to 0.99 as six independent readings and land several points away from the
  // number at the top of the section, inviting the reader to wonder which of
  // the two the page believes.
  if (spread.columns.every((col) => col)) {
    list.append(row([
      fill(c.spreadCombined, { waysWord: numberWord(rows.length) }),
      ...spread.columns.map((col) => ordinal(100 * (1 - col!.p))),
    ], "spread-average"));
  }
  box.append(list);
  el.spreadChart.replaceChildren(box);
}
