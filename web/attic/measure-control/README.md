# Measure control: Count / Moment (parked)

The "Measure" fieldset offering Count or Moment. Parked 2026-08-23 at the
author's request; only Count is offered now.

## What was removed

- the fieldset (`markup.html`) from index.html, between Period and Catalog
- `MEASURES`, the `el.measure` lookup, its `buildSegmented` call, and
  `syncControlAvailability()` (`logic.ts`) from src/main.ts
- the two `syncControlAvailability()` call sites in `buildControls()`

`state.measure` is now pinned to `"count"` and never changes.

## What was deliberately LEFT in place

Every `state.measure === "moment"` branch in the rendering code is still there
and is now unreachable. Unpicking them means touching the cumulative chart, the
annual chart, the axis labels, the strip chart and the screen-reader summary,
which is a much larger change than removing a control, and it would all have to
be written again to bring Moment back. They are dead, not broken.

Where they are, as of this commit:
  formatValue / asMagnitude   ~line 197-207
  applyLive                   ~line 550   (seismicMoment per live event)
  spreadTable                 ~line 729   (the `["count", "moment"]` loop)
  subject / annual title      ~line 1550, 1563
  strip chart                 ~line 1600-1640
  y-axis labels               ~line 1648, 1661
  screen-reader summary       ~line 1743

The `.is-off` rules are in `styles.css` here; they greyed the Catalog control
while Moment was selected. The `catalogField` element lookup went too -- nothing
else referenced it.

## To restore

Put `markup.html` back in index.html, the four pieces of `logic.ts` back in
src/main.ts, restore the `syncControlAvailability()` call at the end of
`buildControls()`, and change `measure: "count"` in the state initialiser back
to being reachable.
