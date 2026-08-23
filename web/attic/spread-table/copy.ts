// Display-only keys for the spread block. Removed from src/copy.ts under
// copy.home. The row LABELS (spreadLabel, spreadAll, spreadMainshocks,
// spreadCount, spreadMoment) are NOT here: spreadTable() still builds them,
// because it still runs to feed the hero histogram and the technical summary.

    spreadColWay: "How it is counted",
    spreadCalendar: "This year so far",
    spreadRolling: "Last 365 days",
    /* The aggregate answer. Stouffer's Z over the ways of counting, with the
       divisor corrected for how strongly they correlate -- Strube's version,
       with the correlations measured from the past years rather than assumed.
       Pooling, not a multiplicity correction: every way of counting tests the
       same claim, so the question is what they say together, not whether any
       one of them crosses a line. */
    spreadAggregate: "{year} is in the {percentile} percentile, so far.",
    /* Not a mean. The slicings overlap heavily -- M6+ and M7+ moment correlate
       at 0.99 -- so they are pooled with the divisor corrected for that, which
       is what the headline above the table quotes. Saying only "averaged"
       invited the reader to check it by adding up the column and dividing, and
       get a different number. */
    spreadCombined: "All {waysWord} combined, allowing for their overlap",
