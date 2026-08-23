# The trend section's other three series (parked)

Parked 2026-08-23. The section now fits one series -- M6+, mainshocks only --
instead of four.

## What it was

Four fixed series: M6+ and M7+, each with aftershocks left in and taken out.
Four tests meant four chances for one to look unusual, so they were combined
by a Westfall-Young max-T permutation test rather than by Sidak's formula:
the series are nested, so Sidak over-states the correction. The technical
summary quoted both numbers so the difference was visible.

With one series there is no multiplicity to correct, so the permutation test
now simply gives that series' own p-value, and everything about combining,
about the range of p-values across the four, and about the correlation between
them has gone from the copy.

## What went with it

`techValues.trendLow`, `trendHigh`, `sidak`, `corrMin` and `corrMax` are no
longer set or interpolated. `correlationRange()` in src/main.ts is unused --
left in place, because it is small and it is what a second series would need.

The panel grid is one column now; it was two.

## To restore

Put `TREND_SERIES` back (`logic.ts`), restore the six copy keys and the two
technical-summary paragraphs (`copy.ts`), and put the `techValues` assignments
back in `writeTrend`.
