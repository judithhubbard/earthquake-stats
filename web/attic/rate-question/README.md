# "Is the rate of earthquakes changing?" — the second question

Shelved 2026-08-23. The whole second `section.question`: its verdict sentence,
the M6+ mainshocks chart, the ten-year histogram, and the band table beside it.

## What it did

It compared the last ten years against the rest of the record. If the rate had
never changed, every earthquake in the catalogue would have been equally likely
to fall in any year, so the number landing in the last ten follows a binomial
distribution conditioned on the total — an exact two-sample comparison that
already pays for the earlier years' rate being an estimate. `recentShareP` gave
the p-value; `shareBands` gave the counts a decade could hold at 95%.

Three answers, five sentences: "maybe, more", "maybe, fewer", and three
flavours of no. It never said yes, because one decade cannot settle a question
about the whole record.

Ten years was fixed in advance. At the time of shelving the p-values were 0.28
at five years, 0.51 at ten, and 0.067 at fifteen — which is exactly why the
window could not be chosen after looking.

The histogram ranked every ten-year stretch in the record. That shows where the
recent one sits but is **not** a test: consecutive stretches share nine of their
ten years, so their ranking cannot be a p-value. The verdict rested on the
binomial alone.

## Files

- `markup.html` — the section, as it sat between the first question and the panel
- `logic.ts` — `writeDecades()` and the render call for the mainshocks chart
- `copy.ts` — the strings, including the two technical-summary paragraphs
- `styles.css` — `.decade-*`, and the white-bed selector `#rate-chart` shared

## To restore

Note what the live page absorbed on the way out:

- The first question's chart now counts **all** earthquakes, aftershocks
  included, because that is the series its answer is read from. Restoring this
  section means computing both series again — `annualCurvesFor(threshold,
  declustered)` still takes the flag.
- `flipTable()` grew an optional `swatches` argument (one tint per row, keyed to
  the bar above the table). It is still there and still unused by anything else.
- The hero intro still asks "is the rate of earthquakes changing?" — with this
  section gone, the page no longer answers that question.
