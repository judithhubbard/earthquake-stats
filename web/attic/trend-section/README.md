# The trend section (parked)

"Is the rate of earthquakes changing?" -- the fitted line through yearly
counts, its permutation p-value, and the flip table under it. Parked
2026-08-23; the annual-counts chart above it took the title.

## What it did

Least squares through the yearly counts of M6+ mainshocks, with the p-value
from shuffling the year labels TREND_PERMUTATIONS times and refitting rather
than from the t-distribution. The confidence band under the chart was the
range of slopes the data could not rule out.

Earlier it fitted four series and corrected for the four looks with a
Westfall-Young max-T permutation test; that machinery is in
attic/trend-multi-series.

## What went with it

`techValues.joint` and `techValues.shuffles` are no longer set, so the
technical summary paragraph that quoted them went too -- it is in `copy.ts`
here as `techTrend`.

`combinedTrendP`, `trend` and `TREND_PERMUTATIONS` stay in src/stats.ts.

## To restore

Markup back inside the panel, the functions back in src/main.ts, the copy
keys back in `copy.home`, the styles back in src/style.css, and the element
lookups: trendQuestion, trendVerdict, trendBody, trendTable, trendGrid.
