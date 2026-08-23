    annualTitleCount: "Is the rate of earthquakes changing?",
    /* Fixed, like the headline: this section asserts something about the world,
       so the reader cannot pick the slice that best supports an answer. */
    /* Box one counts every earthquake, aftershocks included, because that is
       the series its answer is read from. Box two removes them, because one
       great earthquake can add a hundred events to a decade and no decade can
       be compared with another while that is true. */
    annualIntro:
      "This chart shows every {threshold} earthquake recorded worldwide, aftershocks " +
      "included, in each twelve-month window since 1976.",
    annualBand:
      "Where does the last year fall? In 90% of years, we expect to see between {lo} and " +
      "{hi} {threshold} earthquakes. In the last 365 days, there have been {n}.",
    rateIntro:
      "This chart shows {threshold} earthquakes globally, after removing aftershocks, to " +
      "evaluate whether the rate of earthquakes is changing over time. Because we have removed " +
      "aftershocks, the annual numbers are lower than in the previous plot. One large " +
      "earthquake can trigger many aftershocks, which would skew these results. A large " +
      "earthquake with many aftershocks does not tell us that the rate is changing.",
    annualTitleMoment: "Is the rate of moment release changing?",

    /* The verdict alone. What decides it is in the table beside the histogram,
       where a reader can see the whole range of answers rather than being told
       which one came up. */
    /* Never "yes". The section asks whether the rate is changing, and one
       decade cannot settle that however far from average it lands -- it is one
       piece of evidence about a question that spans the whole record.

       Five readings, three answers. The table beside the chart is a fixed
       reference and says only which band a count falls in; the sentence reads
       the data, so it can say which side of average a decade sat on without
       the table carrying a row for it. */
    decadeMaybeMore:
      "<strong>Maybe.</strong> There have been more earthquakes than expected in the last decade.",
    decadeBusy: "<strong>No.</strong> It\u2019s been a busy decade, but not unusual.",
    decadeUsual: "<strong>No.</strong> The rate is about the same as usual.",
    decadeQuiet: "<strong>No.</strong> It\u2019s been a quiet decade, but not unusual.",
    decadeMaybeFewer:
      "<strong>Maybe.</strong> There have been fewer earthquakes than expected in the last decade.",
    decadeCheck:
      "To check, we looked at the rate of earthquakes in the last ten years. Can we see a " +
      "difference in the last decade compared to previous decades?",
    /* Ten years is fixed in advance and cannot be a control: on the current
       catalogue the five-year window reads 28%, the ten 51% and the fifteen
       6.7%, so a window chosen after looking would report the fifteen. */
    decadeColP: "Earthquakes in the last ten years",
    decadeColAnswer: "The answer",
    decadeBandFewest: "{n} or fewer",
    decadeBandUsual: "{lo} to {hi}",
    decadeAnsFewer: "Maybe — there have been fewer than expected in the last decade",
    decadeBandMost: "{n} or more",
    decadeAnsMore: "Maybe — there have been more than expected in the last decade",
    decadeAnsNo: "No — the last decade is within the expected range",
    decadeNow: "Right now: {value}",
    decadeHelp: "how is this calculated?",
    decadeHelpBody:
      "The earlier years of the record average {rate} a year, so a decade should hold about " +
      "{expected}. These ranges are how far from that a decade can land by chance alone.",
    decadeShareCount: "{n}",
    decadeShareMore: "of {peers} earlier stretches were busier",
    decadeCaption:
      "Total {threshold} earthquakes in each ten-year stretch since {from}; aftershocks removed",
    decadeCurrent: "last ten",

    axisAnnualMainshocks: "{threshold} earthquakes per year, aftershocks removed",

    decadeBasis: "Calculated based on {threshold} earthquakes worldwide, aftershocks removed",

    /* from the technical summary */
"\n\n**Is the rate changing?** That section is fixed on {threshold} mainshocks whatever " +
      "the controls say, because it asserts something about the world rather than describing " +
      "a selection. The last ten years are compared against the rest of the record: if the " +
      "rate never changed, every earthquake would be equally likely to have fallen in any " +
      "year, so the number landing in the last ten follows a binomial distribution. That is " +
      "exact rather than approximated, and it already pays for the earlier years' rate being " +
      "an estimate. The ranges beside the chart are where it puts a decade 95% of the time, " +
      "currently {decadeLow} to {decadeHigh}." +

      "\n\nTen years is fixed in advance, because a window chosen after looking would be " +
      "chosen for its answer. The histogram ranks every ten-year stretch in the record, which " +
      "shows where the recent one sits but is not itself a test: consecutive stretches share " +
      "nine of their ten years. And a single decade cannot settle a question about the whole " +
      "record, which is why that section never answers yes." +
