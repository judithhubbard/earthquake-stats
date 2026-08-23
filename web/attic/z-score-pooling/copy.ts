// copy.home keys
    aggregateShareCount: "{n}",
    aggregateShareMore: "of {peers} years scored higher",
    aggregateCurrent: "{year}",
    aggregateCaption: "z-score for every year since {from}",
    aggregateHelp: "what is a z-score?",
    spreadLabel: "{threshold} {catalog}, {measure}",
    spreadAll: "all earthquakes",
    spreadMainshocks: "mainshocks only",
    spreadCount: "counted",
    spreadMoment: "by moment",
    /* A count, not a percentage. The headline percentile comes off the fitted
       curve and this comes off the bars, so on fifty years they differ by
       about one -- and while both were percentages, sitting inches apart, the
       reader was invited to subtract one from a hundred and find the other.
       "11 of 50" describes the picture instead of competing with it. */

// copy.home.tech paragraphs
"\n\n**The answer at the top ignores the user selections.** Depending on what " +
      "earthquakes a user selects, they can land at different percentiles. For instance, this " +
      "year the selected earthquakes can yield anywhere from the {spreadLow} to the " +
      "{spreadHigh} percentile. " +
      "The answer at the top pools the {waysWord} calendar-year ways of counting from the " +
      "table higher up the page." +

"\n\n**How the aggregate statistics work.** Each way of counting ranks this year " +
      "against every year since {from}, which gives {waysWord} p-values. Stouffer's method " +
      "turns " +
      "each " +
      "into a " +
      "z-score, adds them, and divides by how much that sum could vary by chance — by the " +
      "spread of the scores as well as by how strongly they move together, so the combined " +
      "score has a standard deviation of one. The percentile at the top is then read off the " +
      "normal curve. Every past year is scored the same way, and the histogram beside the " +
      "answer draws all of them, so the share it reports is a count of years rather than the " +
      "curve: on {peers} past years the two agree to about a percentile. The last-365-days " +
      "combinations " +
      "are left out: a window ending today is not a year, so it cannot be ranked against " +
      "past years." +

"\n\n**The tests are not independent.** The usual divisor assumes the tests are " +
      "independent. They are not: a year busy in M6+ is usually busy in M7+, " +
      "and by moment the two are almost the same number, because a year's moment comes mostly " +
      "from its largest earthquakes. Measured against the record, the {waysWord} different " +
      "dependent tests are worth about {effective} independent tests. That is Strube's " +
      "correction, with the correlations taken from the data rather than assumed." +
