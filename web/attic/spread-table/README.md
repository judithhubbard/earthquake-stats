# Spread table (parked)

The sentence "2026 is in the Nth percentile, so far." and the table of ways of
counting underneath it. Parked 2026-08-23 at the author's request.

## What it was

Every combination the controls can reach, scored the same way, so a reader could
see how much the answer depends on which one they are looking at -- rather than
discovering it by clicking, or not discovering it at all. The last row pooled
them with Stouffer's Z, divisor corrected for their overlap, which is the same
figure the sentence above the table quoted.

## What is still running

`spreadTable()` in src/main.ts is NOT parked. It still computes everything, and
two things downstream depend on it:

- the hero z-score histogram (`writeAggregateChart` -> `#answer-aggregate`)
- the technical summary, via `techValues.spreadLow`, `spreadHigh`, `ways`,
  `waysWord`, `effective`, `peers`

So the numbers are all still calculated; only the display is gone.

## To restore

1. `markup.html` -> back into index.html, inside `<header class="hero">`,
   after the `.hero-intro` paragraph.
2. `styles.css` -> back into src/style.css.
3. `copy.ts` -> the keys back into `copy.home` in src/copy.ts.
4. `logic.ts` -> replace `writeSpread` in src/main.ts, and restore the three
   element lookups in `el`:
   `spread: document.getElementById("spread") as HTMLElement,`
   `spreadAggregate: document.getElementById("spread-aggregate")!,`
   `spreadChart: document.getElementById("spread-chart")!,`

Note `logic.ts` is the version from before the measure control was parked: it
assumes six rows. With count-only it is four.
