# The z-score, and the pooling behind it (parked)

Parked 2026-08-23. The headline is now a single fixed series -- M6+, all
earthquakes, last 365 days -- shown as a count with the verdict read off its
percentile, so nothing is pooled any more.

## What this was

Every combination the controls could reach was scored, and the results pooled
with Stouffer's Z, divisor corrected for how strongly the slicings correlate
(Strube's version, with the correlations measured from the record rather than
assumed). Six dependent tests were worth about 1.7 independent ones. The
percentile that came out drove the headline, and the histogram beside it drew
every past year scored the same way.

The argument for it was that the answer should not move when the reader clicks.

## Contents

- `logic.ts`   SpreadCell/SpreadRow, leaveOneOutPercentiles, SPREAD_WINDOWS,
               spreadTable, writeSpread, writeAggregateChart, and the
               `answerAggregate` element lookup
- `copy.ts`    the aggregate* and spread* keys, and the three technical-summary
               paragraphs that described the pooling
- `styles.css` .answer-row and .answer-caption

`combineRanks` stays in src/stats.ts -- it is a library function and costs
nothing unused.

## What went with it

`techValues.spreadLow`, `spreadHigh`, `ways`, `waysWord`, `effective` and
`peers` are gone from src/main.ts: the only copy interpolating them is here.

## To restore

The markup was one line in index.html inside `.answer-row`:

    <div class="answer-detail" id="answer-aggregate"></div>

with `.answer-text` wrapping the answer paragraph beside it. Note the headline
now reads off `headlineSeries()` rather than a pooled score, so restoring means
deciding again which of the two the sentence should use.
