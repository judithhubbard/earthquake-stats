# The ±2σ toggles (parked)

Parked 2026-10-07 at the author's request. Two controls went:

- the "Range" switch on the cumulative chart, "50 / 90%" or "±2σ (95.45%)".
  With ±2σ gone it had one option left, so the switch went too.
- the "±2σ (95.45%)" on/off button on the yearly bar chart.

## What was removed

- `markup.html`: both control spans, from `unusual/index.html`
- `logic.ts`: `RANGES` as it was, `ANNUAL_SIGMA_LABEL`, the two `el` lookups,
  their two builder calls in `buildControls()`, and `buildToggle()`, which
  nothing else used
- `copy.ts`: the technical-summary paragraph describing both settings, now
  shortened to the percentile bands alone

## What was deliberately LEFT in place

`state.range` is pinned to `"percentile"` and `state.annualRange` to `"off"`.
Every `=== "sigma"` branch downstream -- `rollingWindowBand`, the legend, the
chart's `bandMode`, the notes, `legendSigma`/`noteSigma` in copy -- is still
there and now unreachable. Dead, not broken, as with the measure control.

## Why it may be worth leaving out

Annual M6+ counts are overdispersed (variance/mean about 3.6) and skewed
right, so "±2σ = 95.45%" is a normal-distribution figure the data does not
follow: the yearly band held 46 of 49 years with all three misses on the high
side. The percentile bands make no such assumption.

## To restore

Put the two spans back from `markup.html`, the pieces of `logic.ts` back in
src/main.ts, and the paragraph from `copy.ts` back in `techBody`.
