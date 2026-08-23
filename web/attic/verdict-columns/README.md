# The two-column verdict layout

Stored 2026-08-23, while it was the live design. Not shelved — the one-column
variant replaced it in the same files, and this is the snapshot to come back to.

## What it was

`.verdict-cols`, a grid of `clamp(17rem, 36%, 24rem)` and `1fr`:

- **Left, the key.** The band table, the basis line, and the 90% sentence. It
  stayed beside every figure, so a reader looking at any chart could see what
  the five bands meant without scrolling back.
- **Right, the figures.** The distribution and the yearly bars, each opened by
  a heading over a hairline, no white beds.

The question and the answer sat above both, full width, in their own ruled
band — that part is unchanged by the one-column variant.

## Why it needed care

Three things had to be true together or it looked broken, and each one took a
round to find:

1. **The key column has to hold "Busy, but not unusual" on one line.** Below
   about 17rem the rows wrap, five become eleven, and the column runs some
   400px past the figures beside it.
2. **The rows align to the top, not the baseline.** The swatch is an empty box,
   so on a baseline grid it takes the baseline of the *last* line of a wrapped
   answer and sinks to the bottom of its own row.
3. **The figures have to be tall enough to match.** 150px and 200px left the
   right column ending well above the left; 200px and 230–330px balanced it.

The breakpoint is 42rem, not 58: `main` is 60rem wide, so a breakpoint anywhere
near that stacks the layout on most windows. This mistake was made twice.

## To restore

Put `styles.css` back over the one-column rules in `src/style.css`, and
`markup.html` back into the `section.question`. Then check the three points
above, in that order.
