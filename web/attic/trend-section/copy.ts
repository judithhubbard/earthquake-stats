// copy.home keys
    trendQuestion: "Is the rate of earthquakes changing?",
    trendIntro: "To find out, we took all {threshold} earthquakes worldwide and removed the " +
      "aftershocks. Then, we plotted the number year-over-year and fit a straight line to " +
      "the data.",
    trendNo: "",
    trendMaybe: "The line slopes, but not by enough to rule out chance: counts with no trend in " +
      "them produce a slope at least this steep {corrected}% of the time. Worth watching " +
      "rather than announcing.",
    trendProbably: "The line slopes by more than chance comfortably explains: counts with no trend in " +
      "them produce a slope at least this steep only {corrected}% of the time. That is a " +
      "real change in the rate at this magnitude and this setting, which is not the same as " +
      "a change in the Earth.",
    trendPanelAll: "{threshold}, all earthquakes",
    trendPanelMainshocks: "{threshold}, mainshocks only",
    trendPanelAxis: "{threshold} mainshocks per year",
    trendPanelStat: "{low} to {high} per decade · p = {p}%",

    trendColCombined: "p-value for the fitted slope",
    trendHelp: "how is this calculated?",
    trendHelpBody:
      "A straight line is fitted through the {years} yearly counts, and the question is " +
      "whether its slope means anything." +
      "\n\nTo find out, the years are shuffled into a random order and the line refitted, " +
      "{permutations} times over. Shuffling breaks any real trend, so those {permutations} " +
      "slopes are what counts with no trend in them look like. Comparing the real slope " +
      "against them: counts with no trend produce a slope at least this steep {corrected}% of " +
      "the time. A small number would mean the slope is hard to put down to chance; a large " +
      "one means it is not." +
      "\n\nThe range under the chart is every slope the data cannot rule out, at 95% " +
      "confidence. When it includes zero, no change at all is one of them — which is why the " +
      "range is shown rather than the single number in the middle of it, a number that " +
      "invites arithmetic the data cannot support." +
      "\n\nA straight line is an assumption too. It would not detect a rate that rose and " +
      "then fell back.",


// copy.home.tech paragraph
      "\n\n**Is the rate changing?** A straight line is fitted by least squares through the " +
      "yearly counts of {threshold} mainshocks, and the slope is tested against no slope at " +
      "all. The p-value comes from shuffling the year labels {shuffles} times over and " +
      "refitting, rather than from the t-distribution, so it does not assume the counts are " +
      "normally distributed. It currently reads {joint}%." +

