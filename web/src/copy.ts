/**
 * EVERY WORD THE SITE SAYS, IN ONE FILE.
 *
 * -------------------------------------------------------------------------
 * EDITING THIS FILE
 *
 * Change the text between the quote marks. That is all there is to it.
 *
 *   answerAverage: "No. {year} is running about average.",
 *                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ edit this part
 *
 * Things in {curly braces} are filled in with live numbers when the page
 * loads. Keep them spelled exactly as they are, or they will show up on the
 * page as literal braces. You can move them around inside a sentence, use one
 * twice, or drop one you do not want.
 *
 * A few strings contain <strong>…</strong>, which makes text bold. Any other
 * HTML works too, but the tags must be closed.
 *
 * If a line contains an apostrophe, that is fine. If you need a double quote
 * inside the text, write it as \" or switch the surrounding quotes to
 * backticks (`like this`).
 *
 * After editing, `npm run build` from the web/ directory, or just commit and
 * push — the site rebuilds itself on every push.
 * -------------------------------------------------------------------------
 */

/** Replaces {tokens} with live values. Unknown tokens are left visible on purpose. */
/**
 * Small counts as words, for prose that reads badly with a numeral in it --
 * "Correcting for five questions", not "Correcting for 5 questions".
 *
 * The number still comes from the code; this only chooses how to write it.
 * Anything above twelve stays a numeral, which is the usual house rule and
 * also the point at which these counts stop being sentence-sized.
 */
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
               "eight", "nine", "ten", "eleven", "twelve"];

export function numberWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

export function fill(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in values ? String(values[key]) : whole);
}

export const copy = {

  /* ===================================================================
     THE FRONT PAGE
     =================================================================== */
  home: {
    /** The one-word answer. Whichever line fits the year is used. */
    answerBusiest: "<strong>Yes.</strong> {year} is ahead of almost every year since {from}.",
    answerQuietest: "<strong>No — less.</strong> {year} is quieter than almost every year since {from}.",
    answerBusy: "<strong>No.</strong> {year} is busy, but not unusually so.",
    answerQuiet: "<strong>No.</strong> {year} is running on the quiet side.",
    answerAverage: "<strong>No.</strong> {year} is running about average.",
    answerNothingYet: "<strong>No.</strong>",

    /** The same answers for the rolling window, which is complete rather than
        part-way through, so "running" and "so far" would both be wrong. */
    rollingBusiest: "<strong>Yes.</strong> The last 365 days beat almost every year since {from}.",
    rollingQuietest: "<strong>No — less.</strong> The last 365 days were quieter than almost every year since {from}.",
    rollingBusy: "<strong>No.</strong> The last 365 days were busy, but not unusually so.",
    rollingQuiet: "<strong>No.</strong> The last 365 days were on the quiet side.",
    rollingAverage: "<strong>No.</strong> The last 365 days were about average.",
    detailCountRolling:
      "{count} {threshold} {kind} in the last 365 days — usual is {median} — {above}% of years " +
      "since {from} had more {kind}",
    detailMomentRolling:
      "{count} released in the last 365 days — as much as a single M{equivalent} earthquake — " +
      "usual is {median} — {above}% of years since {from} released more",

    /** The sentence under the answer. */
    detailCount:
      "{count} {threshold} {kind} so far — usual is {median} — {above}% of years since {from} " +
      "had more {kind}",
    detailMoment:
      "{count} released so far — as much as a single M{equivalent} earthquake — usual is " +
      "{median} — {above}% of years since {from} released more",
    /* Labels on the distribution strip under the answer. The sentence those
       replaced is still in detailCount below, read aloud to screen readers. */
    stripCurrent: "{year}: {count}",
    stripCurrentMoment: "{year}: M{count}",
    stripShare: "{share}%",
    /* Two lines: "34% of years had more" leaves the reader to work out more
       what, and the answer changes with the controls. The second line is what
       is being counted, on the same setting the rest of the page is on. */
    stripShareMore: "of years had more\n{subject}{when}",
    stripShareMoreMoment: "of years released more\nmoment{when}",
    /* Only on the calendar view. The rolling one is a full twelve months, so
       there is no date to count up to -- "by 21 August" would be wrong there. */
    stripShareBy: "\nby {date}",

    /* The spread strip under the answer. Every combination the controls above
       can reach, so the reader can see how much the answer depends on which
       one they are looking at -- rather than discovering it by clicking, or
       not discovering it at all. */
    spreadLabel: "{threshold} {catalog}, {measure}",
    spreadAll: "all earthquakes",
    spreadMainshocks: "mainshocks only",
    spreadCount: "counted",
    spreadMoment: "by moment",
    spreadColWay: "How it is counted",
    spreadCalendar: "This year so far",
    spreadRolling: "Last 365 days",
    /* The one number that answers the title question with no choice hidden in
       it. Every past year is scored the same {ways} ways and its own average
       taken, so this year's average can be ranked against theirs directly --
       no correction, because the redundancy between the slicings applies
       equally to every year being compared. */
    /* The aggregate answer. Stouffer's Z over the six ways of counting, with
       the divisor corrected for how strongly they correlate -- Strube's
       version, with the correlations measured from the past years rather than
       assumed. Pooling, not a multiplicity correction: every way of counting
       tests the same claim, so the question is what they say together, not
       whether any one of them crosses a line. */
    spreadAggregate: "{year} is in the {percentile} percentile, so far.",
    aggregateShareMore: "of years scored higher",
    aggregateCurrent: "{year}",
    aggregateCaption: "z-score for every year since {from}",
    aggregateHelp: "what is a z-score?",
    aggregateHelpBody:
      "A z-score says how far a year sits from the middle, measured in units of the ordinary " +
      "year-to-year spread. Zero is an average year." +
      "\n\nThere are many ways to look at earthquake numbers; we show {waysWord} of them below. " +
      "This z-score combines those {waysWord} into a single representative number.",
    spreadNote:
      "These individual metrics each tell us something about how many earthquakes there have " +
      "been in {year}. The number at the top combines the {waysWord} in the “{column}” " +
      "column into an overall assessment.",

    detailNoneCount: "No {threshold} {kind} recorded worldwide yet in {year}.",
    detailNoneMoment: "No moment released worldwide yet in {year}.",

    /* Chart headings. */
    cumulativeTitle: "Cumulative {subject} worldwide",
    cumulativeSubjectCount: "{threshold} {kind}",
    cumulativeSubjectMoment: "moment release from {threshold} earthquakes",
    annualTitleCount: "{threshold} {kind} per year, worldwide",
    annualTitleMoment: "Moment released per year, worldwide",
    mapTitle: "{threshold} earthquakes, selected years",

    /* Axis labels. */
    axisCumulativeCount: "{threshold} events this year",
    axisCumulativeMoment: "Moment this year, as a single earthquake",
    axisAnnualCount: "{threshold} events per year",
    axisAnnualMoment: "Moment per year, as a single earthquake",

    /* The small print under the cumulative chart. */
    noteBand:
      "Each faint line is one of the {years} previous years. The inner band spans the middle " +
      "50% of those years and the outer band the middle 90%. A line inside the shading falls " +
      "within the range of previous years.",
    noteSigma:
      "Each faint line is one of the {years} previous years. The band is the mean plus " +
      "and minus two standard deviations — the range a normal distribution would put " +
      "95.45% of the data in. It is measured over every window of this length anywhere " +
      "in the record, not over the calendar years.",
    noteMoment:
      "Moment measures how much the ground moved, not how often. One great earthquake can " +
      "outweigh a whole ordinary year, so this line can jump in a single afternoon.",
    noteMainshocks:
      "Aftershocks have been removed, so each earthquake sequence counts once.",
    noteLiveUnclassified:
      "{n} event{s} from the last day {is} too recent to have been sorted, and counted as separate.",

    /* The small print under the annual chart. Two versions: the M7+ share line
       is meaningless when M7+ is the selected threshold, since it would then be
       the whole bar. */
    /* In the rolling view every bar is a complete twelve months, including the
       current one, so there is nothing to project. */
    noteAnnualRolling:
      "Each bar is a full twelve months ending on this date, so the most recent one is " +
      "complete and directly comparable to the rest.",
    noteAnnualRollingMajor:
      "The lighter part of each bar is the {major} share. Each bar is a full twelve months " +
      "ending on this date, so the most recent one is complete and directly comparable.",
    noteAnnualPlain:
      "{year} is still going: the solid bar shows the year so far, and the dashed outline is " +
      "where it will land if it continues at the usual pace.",
    noteAnnual:
      "The lighter part of each bar is the {major} share. {year} is still going: the solid bar " +
      "shows the year so far, and the dashed outline is where it will land if it continues at the usual pace.",

    /* The map and the year list beside it. */
    mapEmpty: "Select a year to plot its earthquakes.",
    largestEmpty: "No {threshold} {kind} recorded in {years}.",
    largestNoYears: "Select a year above to list its earthquakes.",
    largestNote: "{n} {threshold} {kind}.",
    largestTruncated: "{n} {threshold} {kind} — showing the first {shown}.",
    largestNoDetail: "No event details available at this magnitude.",
    largestFailed: "Could not load event details.",
    readAnalysis: "Read our analysis →",

    /* Legend and controls. */
    legendOtherYears: "Other years, since {from}",
    legendMedian: "Average year (median)",
    legendBand: "Middle 90% of past years",
    legendBandInner: "Middle half of past years",
    legendMean: "Average year (mean)",

    /* The scale at the foot of the page: every headline the site can print, how
       wide a slice of the percentile range earns it, and how often that is. */
    scaleTitle: "Every answer this page can give",
    scaleRow: "{low}–{high}th percentile",
    scaleFrequency: "{n} years in 100",
    scaleNote:
      "The answer is chosen automatically by comparing this year with past years, combining " +
      "every way of counting shown above rather than any one of them. Right now that puts " +
      "{year} at the {percentile} percentile.",
    legendSigma: "±2σ — 95.45% under a normal fit",
    yearsNone: "None",
    yearsSome: "{n} years",
    yearsCount: "{n} of {max}",

    /* The trend section under the annual chart.

       Four fixed series, always all four, never responding to the toggles
       above. There are more than eight ways to slice this catalogue and their
       p-values run from 0.07 to 0.85; a reader given the toggles will find the
       0.07 and stop. Showing the whole set, and charging for the search with a
       multiple-comparison correction, is the only honest way to answer the
       question on a page anyone can click through.

       Count only. Every moment series slopes upward at about 25% per decade,
       and all of that is 2004, 2010 and 2011 falling in the second half of the
       record. That is a statement about whether a great earthquake happened,
       not about the rate of earthquakes, and this section asks the latter.

       It reports an interval and never a bare slope: a slope invites "5% a
       decade, so 20% over forty years" from data that cannot tell the line
       from flat. */
    trendQuestion: "Is the rate of earthquakes changing?",
    trendIntro:
      "We fit a straight line through the yearly counts for four different series — {threshold} " +
      "and {major}, each with aftershocks left in and taken out — and ask whether any of the " +
      "four slopes can be told apart from no slope at all." +
      "\n\nIt is tempting to pick and choose \u2014 find the correlation that works, discard " +
      "the rest. That is a common statistical trap known as p-hacking: choosing the test after " +
      "you look at the results. Here, we first calculate the p-value for each test, which tells " +
      "us how unusual that specific correlation is. Then, we calculate the combined probability " +
      "for all four tests, correcting for the fact that we asked the question in four different " +
      "ways — and for the fact that the four overlap. This last number is the one you should " +
      "look at.",
    /* Every one of these leads with the combined number, because that is the
       one the answer is graded on. The steepest single series is named
       afterwards, as context -- naming it first would put the un-corrected
       p-value in the reader's head as the result. */
    trendNo:
      "So the answer is no. Combined across the four tests, counts with no trend in them " +
      "produce a slope at least this steep {corrected}% of the time, which is not unusual at " +
      "all. The steepest single series is {subject}, at {p}%.",
    trendMaybe:
      "That is enough to notice. Combined across the four tests, counts with no trend in them " +
      "produce a slope at least this steep {corrected}% of the time — worth watching rather " +
      "than announcing. The steepest single series is {subject}, at {p}%.",
    trendProbably:
      "Combined across the four tests, counts with no trend in them produce a slope at least " +
      "this steep only {corrected}% of the time. The steepest single series is {subject}, at " +
      "{p}%. That is a real change in the rate at this magnitude and this setting, which is " +
      "not the same as a change in the Earth.",
    /* Said out loud rather than buried. The four series are nested, so Sidak's
       independence assumption does not hold. It fails in the safe direction,
       and saying which direction is the point. */
    trendOverlap:
      "The four series overlap: every {major} earthquake is also an {threshold} earthquake, " +
      "and every mainshock is also an earthquake. Their year-to-year counts correlate with " +
      "each other between {minCorr} and {maxCorr}, so these are not four independent looks at " +
      "the data, and the usual textbook correction — which assumes they are — would be too " +
      "harsh. The combined number above is measured instead of assumed: it comes from " +
      "reshuffling the years and seeing how often four series that genuinely have no trend " +
      "throw up something this steep.",

    trendPanelAll: "{threshold}, all earthquakes",
    trendPanelMainshocks: "{threshold}, mainshocks only",
    trendPanelAxis: "{threshold} per year",
    trendPanelStat: "{low} to {high} per decade · p = {p}%",

    trendColCombined: "Combined p-value for the four tests",
    trendHelp: "how is this calculated?",
    trendHelpBody:
      "A straight line is fitted through the {years} yearly counts of each of the four series, " +
      "and each test asks how often counts with no trend in them would produce a slope at " +
      "least that steep. That gives four p-values. The smallest is {p}%, from {subject}." +
      "\n\nFour tests means four chances for one of them to look unusual, so the four are " +
      "combined into a single number. Because the series overlap, that number cannot come " +
      "from the textbook formula, which assumes the tests are independent. Instead the years " +
      "are shuffled into a random order — the same order for all four series at once, which " +
      "keeps the overlap intact — the four lines are refitted, and the steepest of them is " +
      "recorded. Across {permutations} shuffles, four series with no trend in them produce " +
      "something at least this steep {corrected}% of the time. That is the number the answer " +
      "above is graded on." +
      "\n\nThe range under each chart is where that series' true slope lies with 95% " +
      "confidence. When it includes zero, no change is one of the possibilities the data " +
      "allow — which is why this shows the range rather than the single number in the middle " +
      "of it. That number on its own invites arithmetic the data cannot support." +
      "\n\nA straight line is an assumption too. It would not detect a rate that rose and " +
      "then fell, or a step change. And shuffling the years assumes that, with no trend, one " +
      "year is interchangeable with another — which an aftershock sequence running across New " +
      "Year slightly breaks.",

    /* ===============================================================
       THE TECHNICAL SUMMARY, front page. Plain and direct: what the
       data is, what was done to it, and what that costs.
       =============================================================== */
    techTitle: "Technical summary",
    techBody:
      "**Where the data come from.** Every earthquake here is from the USGS ComCat catalog, " +
      "pulled through the FDSN event service. Quarry blasts, explosions and other " +
      "non-tectonic events are excluded. The catalog is rebuilt every 15 minutes." +

      "\n\n**Magnitudes are converted to Mw.** Moment magnitude, or Mw, is the gold standard " +
      "for measuring earthquake size. However, before around 1984, the USGS used other kinds " +
      "of magnitudes for some earthquakes. Here, we replace those alternative magnitudes with " +
      "Mw where we can, to make earthquakes comparable across years. We use W-phase first, " +
      "then GCMT centroid, then body-wave, then any other Mw — and fall back only where none " +
      "exists. About {mwShare}% of {threshold} events carry an Mw." +

      "\n\n**Aftershocks can be removed.** A year containing one great earthquake carries " +
      "hundreds of smaller ones with it. **Mainshocks only** removes them — the operation is " +
      "called declustering — using Gardner-Knopoff windows, widened to twice the Wells and " +
      "Coppersmith rupture length wherever that is larger: 53 km at M6, 87 km at M7. The " +
      "windows run forward in time only, so " +
      "an earthquake is removed if a larger one came before it and never if a larger one " +
      "followed." +

      "\n\n**The record starts in 1976,** when the Global CMT catalog begins — the earliest " +
      "date from which moment magnitudes are broadly available. Only M6+ and M7+ are offered: " +
      "below M6, how many earthquakes a year contains depends partly on how many seismometers " +
      "were running that year, so counts cannot be compared across decades." +

      "\n\n**Moment/Count.** Count treats every earthquake as one. Moment weights each by the " +
      "size of the fault slip that produced it — how much rock moved, and how far. That is " +
      "not the same as the energy radiated as shaking, though the two rise together. We " +
      "convert moment into an equivalent “earthquake magnitude” via " +
      "the Hanks and Kanamori relation, because otherwise moment spans multiple orders of " +
      "magnitude." +

      "\n\n**The shaded ranges.** The default shows where the middle 50% and middle 90% of " +
      "past years fell on each date. The ±2σ setting uses the mean plus and minus two " +
      "standard deviations, measured over every window of that length anywhere in the " +
      "record rather than over calendar years." +

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
      "correction, with the correlations taken from the data rather than assumed. The " +
      "divisor also accounts for how widely the scores themselves spread, rather than " +
      "assuming each one has a standard deviation of exactly 1." +

      "\n\n**Is the rate changing?** A straight line is fitted by least squares through the " +
      "yearly counts of four fixed series — M6+ and M7+, each with aftershocks left in and " +
      "taken out — and each slope is tested against no slope at all with a t-test. Four " +
      "rather than one, because the answer depends on which you pick: their p-values " +
      "currently run from {trendLow}% to {trendHigh}%." +

      "\n\n**The four are combined by a permutation test.** The textbook correction, " +
      "Šidák's formula, assumes the four tests are independent, and these are nested: every " +
      "M7+ earthquake is also an M6+ earthquake, and the four yearly counts correlate between " +
      "{corrMin} and {corrMax}. So the year labels are shuffled instead — the same shuffle " +
      "across all " +
      "four at once, which keeps the overlap intact — the lines refitted, and the steepest " +
      "recorded. {shuffles} shuffles give the distribution of the steepest slope when " +
      "none of the four is trending. This is the Westfall-Young max-T procedure, evaluated by " +
      "Monte Carlo. Šidák would say {sidak}% where this says {joint}%." +

      "\n\n**What this page cannot tell you.** It counts earthquakes. It does not measure " +
      "their consequences. The two are related, but loosely: a M7 on the mid-Atlantic ridge " +
      "will have no human effects, while a M7 below Los Angeles will cause widespread damage.",

    /* Footer and failures. */
    latest: "latest {threshold}: {when}, M{mag} {place}",
    generated: "Catalog snapshot built {when}; live events appended from the USGS one-day feed.",
    errorCatalog: "Could not load the catalog: {message}",
    errorNoHistory: "Not enough history yet to draw a reference range.",
    errorBoot:
      "{message}. Run the pipeline first: python3 pipeline/fetch.py --backfill && " +
      "python3 pipeline/magnitudes.py && python3 pipeline/decluster.py && python3 pipeline/build.py",
    errorBasemap: "Could not load the basemap.",
  },

  /* ===================================================================
     THE CORRELATIONS PAGE
     =================================================================== */
  correlations: {
    answer: "<strong>No.</strong>",
    detail: "We checked. The data below updates as the USGS catalog does, and every answer on "
      + "this page is computed from it rather than hard-coded.",
    /* The page's own answer, on the same three rungs as the panels. The
       smallest of the five p-values decides which, but only after correcting
       for having asked five questions -- and the correction lands on the same
       1% and 5% lines, since 1 - (1 - 0.0102)^5 is 5%. */
    answerMaybe: "<strong>Maybe.</strong>",
    answerProbably: "<strong>Probably.</strong>",
    detailMaybe:
      "Right now the data show a possible statistical relationship with {subject}. Combined " +
      "across all {tests} questions, a result at least this strong turns up {corrected}% of " +
      "the time when none of them is real. The data below updates as the USGS catalog does, " +
      "and every answer on this page is computed from it rather than hard-coded.",
    detailProbably:
      "Right now the data show a statistical relationship with {subject} strong enough to " +
      "survive having asked {tests} questions: combined across all of them, a result at least " +
      "this strong turns up {corrected}% of the time when none is real. That is worth " +
      "explaining, and it is still not a cause. The data below updates as the USGS catalog " +
      "does, and every answer on this page is computed from it rather than hard-coded.",
    /* The per-question table, left of the combined one. Someone who came for
       one of these five wants that one answered, not averaged into the other
       four: the combined number is the right way to read the page as a whole
       and the wrong way to answer "do sunspots cause earthquakes". */
    pageColQuestion: "The question",
    pageColOwnP: "Its p-value",
    pageColCombined: "Combined p-value for {testsWord} tests",
    pageCombinedNote:
      "This calculation includes the month of the year, the lunar cycle, global temperature " +
      "and solar activity, but not the day of the week — because no one is asking that " +
      "question.",
    pageHelp: "how is this calculated?",
    pageHelpBody:
      "Each question gets its own p-value: how often data with no pattern in it would " +
      "produce a result at least that strong. The smallest of the {testsWord} right now is " +
      "{p}%, from {subject}." +
      "\n\nAsk {testsWord} questions at a 5% cutoff and the chance that at least one crosses " +
      "by chance alone is not 5% but about {anyFlag}%. So the {testsWord} are combined into " +
      "one number: if none of the {testsWord} relationships were real, the chance of seeing a " +
      "p-value at least as small as {p}% somewhere among them is {corrected}%. That combined " +
      "number is what this page answers on." +
      "\n\nThe day of the week is not among them. It is shown as a check on the catalog, not " +
      "as a question about the Earth, and counting it would hold the other {testsWord} to a " +
      "stricter standard for no gain." +
      "\n\nCombining this way needs the {testsWord} tests to be independent of each other, " +
      "which was checked rather than assumed. The month of the year and the lunar cycle are " +
      "two clocks that do not divide into one another, so where an earthquake falls on one " +
      "says nothing about where it falls on the other. The two yearly comparisons share a " +
      "count of earthquakes, so they were tested together by shuffling the years: the " +
      "correlation between them came out at 0.01. The combined number is the same to four " +
      "decimal places either way.",

    legendBand: "±2σ band — should contain 95.45%",
    legendAbove: "More earthquakes than average",
    legendBelow: "Fewer than average",
    subtitleSince: "Magnitude {threshold} and up, since {from}",

    /* Verdict lines shared by the bar panels. */
    verdictNo: "No.",
    verdictDirected: "{strength} — {direction}",
    verdictProbably: "Probably.",
    verdictMaybe: "Maybe.",
    /* The furthest bar, and how many stray bars to expect anyway. Said in one
       breath, because saying "inside the grey" and then "one bar is outside"
       about the same bar reads as a contradiction. */
    /** Appended once the tally is stated, to say what it means. The band is
        built on the null hypothesis, so it is right to name the null. */

    /* Verdict lines shared by the scatter panels. */
    verdictNotEnough: "Not enough data.",

    /* Shown when a test passes its threshold. Passing at the 5% level is not a
       finding, and this is the sentence that says so. */
    /* The no-state sentence. It used to report the +/-2 sigma band, which is a
       different test from the chi-square driving the verdict -- and the two can
       disagree, since a pooled statistic can flag while every bin sits inside
       the band. Quoting p keeps one test in the prose and distinguishes 58%
       from 8%, which a bare "No." does not. */
    noBin:
      "A spread this uneven turns up {p}% of the time when {subject} makes no difference, so " +
      "there is nothing here that needs explaining.",
    maybeBin:
      "The data do show a pattern. Does a pattern mean a cause? If earthquakes occur at " +
      "random, we would expect to see a spread like this {p}% of the time. So this is not a " +
      "full answer, but it suggests the data are worth a deeper look.",
    probablyBin:
      "The data show a pattern that would be unusual by chance: if earthquakes occurred at " +
      "random, a spread like this would turn up only {p}% of the time. That is worth " +
      "explaining, but it is still not a cause. This chart can say the counts are uneven; it " +
      "cannot say what makes them uneven, and one page of tests is not where that gets settled.",
    maybeScatter:
      "The data do show a correlation. Does correlation equal causation? If earthquakes occur " +
      "at random, we would expect to see a correlation like this {p}% of the time. So this is " +
      "not a full answer, but it suggests the data are worth a deeper look.",
    probablyScatter:
      "The data show a correlation that would be unusual by chance: unrelated numbers would " +
      "produce one this strong only {p}% of the time. That is worth explaining, but it is " +
      "still not causation. Two things moving together does not say which moves the other, or " +
      "whether a third thing moves both.",

    /* What each test would have to read for the answer above it to change. The
       page says its answers are computed; these lines are that claim in a form
       a reader can hold against the next update. */
    /* The table under each panel: what the test would have to read for the
       answer above it to change, and where it currently reads. The verdict
       column reuses the verdict strings themselves, so the table cannot
       describe a rule the page does not follow. */
    flipTitle: "This answer is calculated, not hard-coded:",
    flipHelp: "what is a p-value?",
    flipHelpBody:
      "The p-value tells you how often a randomly distributed dataset will produce a spread at " +
      "least as uneven as the one above. At the current p-value of {p}%, we expect that {p} out " +
      "of 100 randomly distributed datasets will look at least this uneven by chance." +
      "\n\nPeople usually use a cutoff of 5% to identify a statistically significant result. " +
      "That does not mean there is a 5% chance the data are random: it means that if they were " +
      "random, we would wrongly call them significant one time in twenty. At a 1% cutoff, one " +
      "time in a hundred." +
      "\n\nOne caution. This page tests {tests} questions, and the more questions you test, " +
      "the more likely one of them crosses the line by chance alone. At a 5% cutoff, the odds " +
      "that at least one of {tests} does are about {anyFlag}%, not 5%.",
    flipHelpR: "what is a correlation coefficient?",
    flipHelpRBody:
      "The correlation coefficient is one way to assess whether two quantities move together, " +
      "or vary independently." +
      "\n\nIt runs from −1 to +1. At 0, knowing one value tells you nothing about the other. " +
      "Near +1, the two rise and fall together. Near −1, one rises as the other falls." +
      "\n\nIt measures straight-line relationships only, and says nothing about which " +
      "quantity would be influencing which.",
    flipHelpRP: "what is a p-value?",
    flipHelpRPBody:
      "The p-value tells you how often {years} pairs of unrelated numbers will produce a " +
      "correlation at least as strong as the one above, in either direction. At the current " +
      "p-value of {p}%, we expect that {p} out of 100 unrelated datasets will look at least " +
      "this correlated by chance." +
      "\n\nPeople usually use a cutoff of 5% to identify a statistically significant result. " +
      "That does not mean there is a 5% chance the two are unrelated: it means that if they " +
      "were unrelated, we would wrongly call them significant one time in twenty. At a 1% " +
      "cutoff, one time in a hundred." +
      "\n\nOne caution. This page tests {tests} questions, and the more questions you test, " +
      "the more likely one of them crosses the line by chance alone. At a 5% cutoff, the odds " +
      "that at least one of {tests} does are about {anyFlag}%, not 5%.",
    /* Column headings, then the conditions in each. A row is one combination
       of them, and the values underneath sit in the column they are compared
       against -- classifying a difference as negligible while never showing
       the number that decides it would be the sort of thing this page argues
       against. */
    flipColP: "p-value",
    flipColR: "Correlation",
    flipColAnswer: "The answer",
    flipPStrong: "below 1%",
    flipPWeak: "1% to 5%",
    flipPNone: "above 5%",
    flipRUp: "positive",
    flipRDown: "negative",
    flipRAny: "—",
    flipNow: "Right now: {value}",

    weekdaySubject: "the day of the week",
    weekdayLabel: "Day of the week",
    weekdayQuestion: "Do earthquakes prefer a day of the week?",
    /* The first paragraph is the method and holds whatever the answer is; the
       rest depends on it, so the two are separate strings. */
    weekdayIntro:
      "We took every {threshold} earthquake recorded since {from} — {raw} of them — " +
      "and removed the aftershocks, leaving {count} mainshocks. Then we classified each of " +
      "those by its day of the week in UTC.",
    weekdayTail:
      "More earthquakes occur on {bin}s, at {percent}% above the average. So, are {bin}s " +
      "earthquake days? No — with seven days, one of them is always the busiest, and {percent}% " +
      "is the sort of margin that produces. {noBin} On the plot, the gray shows ±2 standard " +
      "deviations — i.e., where we expect 95.45% to fall.",
    weekdayFlipped:
      "More earthquakes occur on {bin}s, at {percent}% above the average — but with seven days, " +
      "one of them is always the busiest, and the test below does not ask about {bin}s in " +
      "particular. It asks whether the seven counts differ by more than chance allows." +
      "\n\nRight now they do: a spread like this turns up {p}% of the time when the day of the " +
      "week makes no difference. On the plot, the gray shows ±2 standard deviations — i.e., " +
      "where we expect 95.45% to fall." +
      "\n\nWe would read that as a sign of something in the catalog rather than in the Earth. " +
      "Earthquakes have no way to know what day it is, but the people and networks that record " +
      "them keep human schedules.",
    weekdaySubtitle: "Day of the week · {since}",

    monthSubject: "the month of the year",
    monthLabel: "Month of the year",
    monthQuestion: "Do earthquakes have a season? Is there such a thing as earthquake weather?",
    /* Values are filled from the data. The "right next to" line only holds while
       the two largest deviations are adjacent months, so there is a fallback. */
    monthIntro:
      "We classified the same {count} mainshocks by the month each one occurred " +
      "in. Here we show the rate of earthquakes per day within the month, since months have " +
      "different numbers of days.",
    monthPairAdjacent:
      "The largest deviation is {bin1}, which has {pct1}% {dir1} earthquakes than average. That " +
      "might sound suspicious, but it sits right next to the second-largest deviation ({bin2}), " +
      "with {pct2}% {dir2} earthquakes than average!",
    monthPairApart:
      "The largest deviation is {bin1}, which has {pct1}% {dir1} earthquakes than average, and " +
      "the second-largest ({bin2}) runs {pct2}% {dir2}.",
    monthExplain:
      "There is nothing to see here. Month is a proxy for weather, and if weather had a " +
      "noticeable impact on earthquake " +
      "rates, we would see something here, because we see different weather during different " +
      "months. But we don't. It's easy to see why: earthquakes typically start ten kilometers " +
      "or more underground, where the small stresses caused by weather patterns have essentially " +
      "no impact." +
      "\n\nThere are a few locations where there are slight differences between earthquake rates " +
      "between summer and winter, but they are rare and associated with large swings, like the " +
      "South Asian monsoon.",
    monthFlipped:
      "Here, month is a proxy for weather. If weather had a noticeable impact on earthquake " +
      "rates, we would see something here, because we see different weather during different " +
      "months. Right now we do see something: a spread like this turns up {p}% of the time when " +
      "the month makes no difference. Month is a proxy for weather here." +
      "\n\nThat is worth a look, but it is not yet a reason to think weather drives " +
      "earthquakes. Earthquakes typically start ten kilometers or more underground, where the " +
      "small stresses caused by weather patterns have essentially no impact." +
      "\n\nThere are a few locations where there are slight differences between earthquake " +
      "rates between summer and winter, but they are rare and associated with large swings, " +
      "like the South Asian monsoon.",
    monthSubtitle: "Month of the year · {since}",

    moonSubject: "the lunar cycle",
    moonLabel: "Lunar cycle",
    moonQuestion: "Does the moon set off earthquakes?",
    /* Split three ways: the setup, the part that depends on the answer, and the
       two paragraphs that follow whatever it is. Duplicating the last two to
       make a second whole string would have meant editing both forever. */
    moonOpen:
      "Many people have suggested that lunar tides might cause earthquakes — this is a topic " +
      "that has shown up not just in popular culture, but research papers. Here, we show those " +
      "same {count} earthquakes, classified by the lunar day on which each occurred. This chart " +
      "tests the question as it is usually asked: does the count depend on the phase of the " +
      "moon?",
    moonTail: "{noBin}",
    moonRest:
      "As with many things, it is possible to make this question much more complicated — " +
      "looking at different types of stresses, different types of faults, different regions on " +
      "Earth. All of those studies for global earthquakes show ambiguous results at best, and " +
      "non-results at worst. A few careful studies do find a small effect on a small number of " +
      "very sensitive faults, mostly in regions with high subsurface fluid pressures." +
      "\n\nSome people have suggested that tides can be used to predict earthquakes. We tested " +
      "the published claims of tidal precursors directly, and they " +
      "<a href=\"{article}\" data-track=\"substack-tides\" target=\"_blank\" " +
      "rel=\"noopener noreferrer\">did not hold up</a>.",
    moonFlipped:
      "The counts are more uneven than chance comfortably explains: a spread like this turns " +
      "up {p}% of the time when the lunar day makes no difference." +
      "\n\nThis chart cannot say whether that unevenness has the shape a tidal explanation " +
      "would predict. That is a separate question and a different test.",
    moonSubtitle: "Day of the lunar cycle · {since}",
    moonNewMoon: "new moon",
    moonFullMoon: "full moon",

    climateSubject: "global temperature",
    climateLabel: "Global temperature",
    climateQuestion: "Is climate change affecting earthquakes?",
    climateOpen:
      "Some people have suggested that climate change might cause earthquakes to become more " +
      "frequent — suggesting that melting ice, rising sea level, and changes in hydrology could " +
      "affect the rate of earthquakes. While these things can affect earthquakes, the effects " +
      "are very small, and there is no evidence that they cause an effect that rises above the " +
      "level of the noise.",
    climateMiddle:
      "Below, we show the number of {threshold} earthquakes per year, again with the " +
      "aftershocks removed, plotted against the global temperature in that year. Why {threshold} " +
      "instead of {binThreshold}? Earthquake networks have improved over time, so we can detect " +
      "earthquakes now that we could not detect in the 1970s. Because we're looking at " +
      "year-over-year trends here, those kinds of changes in detectability could look like real " +
      "signal. Networks have been good enough since {from} that {threshold} counts can be " +
      "compared decade to decade, though the earliest years are the weakest part of that " +
      "claim: counts rise through the 1970s and 1980s as the global network and routine Mw " +
      "determination matured, then flatten." +
      "\n\nAs before, we remove aftershocks, so our initial catalog of {tierRaw} decreases to " +
      "{tierCount}, which is plenty for this analysis.",
    climateOpenFlipped:
      "Some people have suggested that climate change might cause earthquakes to become more " +
      "frequent — suggesting that melting ice, rising sea level, and changes in hydrology could " +
      "affect the rate of earthquakes. While these things can affect earthquakes, the effects " +
      "are very small. Right now, though, the data show a correlation larger than we would " +
      "usually put down to chance.",
    climateCloseNo: "As expected, we see no change. {stat}",
    climateCloseFlipped: "That is not what we expected. {stat}",
    climateStatNull:
      "The correlation coefficient over {years} years is {r} — a result that unrelated numbers " +
      "produce {p}% of the time, well above the 5% cutoff.",
    climateStatSignificant:
      "The correlation coefficient over {years} years is {r} — a result that unrelated numbers " +
      "would produce only {p}% of the time.",
    climateUp: "more earthquakes in warmer years.",
    climateDown: "fewer earthquakes in warmer years.",
    climateAxis: "Global temperature (°C above 1951–1980)",

    solarSubject: "solar activity",
    solarLabel: "Solar activity",
    solarQuestion: "Does solar activity affect earthquakes?",
    solarExplain:
      "There is a popular hypothesis that solar activity causes earthquakes. We checked, just to " +
      "make sure. The plot below uses the same {tierCount} independent {threshold} earthquakes, " +
      "one count per year, plotted against the number of sunspots. {stat}",
    /* This one runs closer to the threshold than the climate panel, so the
       second version is not hypothetical. */
    solarStatNull:
      "As expected, the correlation coefficient is {r} — a result that unrelated numbers " +
      "produce {p}% of the time, well above the 5% cutoff.",
    solarStatSignificant:
      "The correlation coefficient is {r} — a result that unrelated numbers would produce only " +
      "{p}% of the time.",
    solarUp: "more earthquakes in years with more sunspots.",
    solarDown: "fewer earthquakes in years with more sunspots.",
    solarAxis: "Sunspot number",

    scatterSubtitle: "Each dot is one year, {from} onward",
    scatterYAxis: "{threshold} earthquakes",

    oklahomaQuestion: "Can people cause earthquakes?",
    oklahomaVerdict: "Yes, in some specific locations.",
    oklahomaExplain:
      "After looking at the plot below, you might be surprised to discover that people actually " +
      "can, and do, cause earthquakes. This occurs in places where human activities affect the " +
      "stresses and fluid pressures in the crust enough to cause faults to slip. Oil and gas " +
      "extraction is high on this list, due to the fluid injection and extraction involved. " +
      "Geothermal production can trigger earthquakes. Even activities like building dams can " +
      "cause seismicity to increase." +
      "\n\nCase in point: Oklahoma. The state used to get about {rate} earthquakes of magnitude " +
      "3 or more a year. In {peakYear} it got {peak}. The cause was wastewater from oil and gas " +
      "drilling, pumped back down into the ground. That raised the pressure on faults that were " +
      "already close to slipping. When the state limited the pumping, the earthquakes died away " +
      "again." +
      "\n\nWe can never point to a specific cause for a specific earthquake — each one is the " +
      "product of the accumulated stresses and conditions over hundreds or thousands of years, " +
      "and the earthquake waves don't tell us which parts of those stresses were natural vs. " +
      "artificial. To assess human impacts, we have to look at patterns. In Oklahoma, the rate " +
      "rose by a factor of {ratio}, with events clustering within a few kilometers of active " +
      "injection wells. They followed injection volumes. And then, they declined after the state " +
      "restricted injection in 2015 and 2016.",
    oklahomaSubtitle: "Earthquakes of magnitude 3 or more in Oklahoma, each year",
    oklahomaAxis: "Earthquakes per year",
    oklahomaLegendBars: "Earthquakes that year",
    oklahomaLegendRate: "Normal rate before 2009: about {rate} a year",

    sources: "Data: {list}.",
    /* ===============================================================
       THE TECHNICAL SUMMARY, correlations page.
       =============================================================== */
    techTitle: "Technical summary",
    techBody:
      "**Where the data come from.** Every earthquake here is from the USGS ComCat catalog, " +
      "pulled through the FDSN event service. Quarry blasts, explosions and other " +
      "non-tectonic events are excluded. The catalog is rebuilt every 15 minutes, and these " +
      "panels use everything in it, up to and including the incomplete current year." +

      "\n\n**Magnitudes are converted to Mw.** Moment magnitude, or Mw, is the gold standard " +
      "for measuring earthquake size. However, before around 1984, the USGS used other kinds " +
      "of magnitudes for some earthquakes. Here, we replace those alternative magnitudes with " +
      "Mw where we can, to make earthquakes comparable across years. We use W-phase first, " +
      "then GCMT centroid, then body-wave, then any other Mw — and fall back only where none " +
      "exists. About {mwShare}% of {threshold} events carry an Mw. Only about {binMwShare}% " +
      "of {binThreshold} events do: below M6 most earthquakes have never had a moment " +
      "magnitude published, so the {binThreshold} panels run largely on ComCat's preferred " +
      "magnitude." +

      "\n\n**Aftershocks are removed.** A year containing one great earthquake carries " +
      "hundreds of smaller ones with it. They are removed everywhere on this page — the " +
      "operation is called declustering — using Gardner-Knopoff windows, widened to twice " +
      "the Wells and Coppersmith rupture length wherever that is larger: 53 km at M6, 87 km " +
      "at M7. The windows run forward in time only, so " +
      "an earthquake is removed if a larger one came before it and never if a larger one " +
      "followed." +

      "\n\n**The record starts in {from},** when the Global CMT catalog begins — the " +
      "earliest date from which moment magnitudes are broadly available." +

      "\n\n**Two magnitude thresholds.** For the first three panels, we use {binThreshold}; " +
      "for the last two, {threshold}. This difference is because for the first three panels, " +
      "we stack the data by day of the week, month of the year, or day of the lunar cycle, so " +
      "a change in detection level should cancel out. For the last two panels we're looking " +
      "at data by year; we cut off earthquakes below M{minMag} so that a change in network " +
      "quality won't skew the results." +

      "\n\n**How the answers are decided.** Every panel runs one test and reports a p-value: " +
      "how often data with no pattern in them would give a result at least this strong. Each " +
      "panel is graded on its own p-value; the page as a whole is graded on the combined one. " +
      "Times are taken in UTC throughout. Both p-values come from closed-form approximations " +
      "— Wilson-Hilferty for chi-square, a normal approximation for t — which agree with the " +
      "exact distributions to about a thousandth over the range used here." +

      "\n\n**Day of the week.** A chi-square goodness-of-fit test over seven bins, on six " +
      "degrees of freedom, with the week starting on Monday. Every weekday is the same " +
      "length, so each bin expects a seventh of the total." +

      "\n\n**Month of the year.** A chi-square goodness-of-fit test over twelve bins, on " +
      "eleven degrees of freedom. Months are unequal, so each bin expects earthquakes in " +
      "proportion to the days it actually ran rather than a flat twelfth." +

      "\n\n**Day of the lunar cycle.** A chi-square goodness-of-fit test over {lunarDays} " +
      "bins, on {lunarDf} degrees of freedom. The bins are mean synodic phase — a cycle of " +
      "{synodic} days measured from a fixed new moon — and they are centred on the syzygies " +
      "rather than starting at them, so day 1 straddles the new moon and day {fullMoonDay} " +
      "the full moon. Where the bin edges fall does not change what an even distribution " +
      "looks like. It changes what an uneven one looks like: an edge at either syzygy would " +
      "cut an excess there in half, and that is the one shape this panel is looking for." +

      "\n\n**Temperature and sunspots.** Both compare a yearly series against the annual " +
      "count of {threshold} earthquakes, using a Pearson correlation, with the p-value taken " +
      "from t on n − 2 degrees of freedom. Only complete years are used, so the current one " +
      "is left out." +

      "\n\n**Correcting for {testsWord} questions.** Each panel is tested at a 5% cutoff, so " +
      "across {testsWord} the chance that at least one crosses by luck alone is about " +
      "{anyFlag}%, not 5%. The answer at the top is graded on the combined p-value instead, " +
      "using Šidák's formula. That formula needs the {testsWord} to be independent, and they " +
      "are: the month of the year and the lunar cycle are two clocks of 365.25 and 29.53 " +
      "days, neither of which divides into the other, and the two yearly comparisons were " +
      "checked against each other by shuffling the years." +

      "\n\n**The day of the week is not one of the {testsWord}.** It is a calibration test: " +
      "earthquakes cannot know what day it is, so a result there would say something about " +
      "how the catalog is assembled rather than about the Earth. It is shown, and graded on " +
      "its own p-value, but it is left out of the combined figure — counting it would hold " +
      "the {testsWord} real questions to a stricter standard to guard against an answer " +
      "nobody is looking for." +

      "\n\n**A p-value is not the probability that there is no pattern.** It is how often " +
      "chance alone would produce a result this strong. It also says nothing about size: with " +
      "{kept} earthquakes, a difference of two or three percent is enough to pass a 5% " +
      "cutoff. A result that crosses is worth looking at, not a finding." +

      "\n\n**What these tests cannot do.** A chi-square across bins can say a distribution is " +
      "uneven; it cannot say what makes it uneven. A correlation can say two series move " +
      "together; it cannot say which moves the other, or whether something else moves both. " +
      "Neither can establish a cause, which is why the strongest answer here is Probably." +

      "\n\n**The Oklahoma panel is different.** It is not a test and has no p-value. It shows " +
      "a case where the cause is established by other evidence: the timing, the depth, the " +
      "distance from injection wells, and the decline after injection was restricted.",

    errorLoad: "Could not load the data.",
  },
} as const;
