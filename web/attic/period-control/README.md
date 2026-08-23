# Period control: This year / Last 365 days (parked)

Parked 2026-08-23. The page now always shows the last 365 days.

## What was removed

- the fieldset (`markup.html`) from index.html, first control after Magnitude
- `WINDOWS`, the `el.window` lookup and its `buildSegmented` call (`logic.ts`)
- the calendar branches of `calendarShift()` and `yearLabel()` (`logic.ts` holds
  the originals)

`state.window` is pinned to `"rolling"`. `calendarShift()` now always returns the
distance from 1 January to tomorrow, which is what makes the twelve months
ending today a complete "year" that can be compared against equally complete
windows from earlier years. `yearLabel()` always returns the "2025-26" form.

`SPREAD_WINDOWS` was cut to `["rolling"]` at the same time, so anything pooled
is pooled over the rolling column only.

## To restore

Put the fieldset back, restore the four pieces of `logic.ts`, make
`state.window` reachable again, and widen `SPREAD_WINDOWS` back to
`["calendar", "rolling"]`. Note the headline copy: `answerFor()` takes a
`rolling` flag that now always receives `true`.
