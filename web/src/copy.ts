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
    answerQuietest: "<strong>No — fewer.</strong> {year} is quieter.",
    answerBusy: "<strong>No.</strong> {year} is busy, but not unusual.",
    answerQuiet: "<strong>No.</strong> {year} is running on the quiet side.",
    answerAverage: "<strong>No.</strong> {year} is running about average.",
    answerNothingYet: "<strong>No.</strong>",

    headlineShareCount: "{n}",
    headlineShareMore: "of {peers} other windows had more",
    headlineCaption: "{threshold} earthquakes per 365 days, since {from}",

    /** The same answers for the rolling window, which is complete rather than
        part-way through, so "running" and "so far" would both be wrong. */
    rollingBusiest: "<strong>Yes.</strong> {span} beat almost every year since {from}.",
    rollingQuietest: "<strong>No — fewer.</strong> {span} was quieter.",
    rollingBusy: "<strong>No.</strong> {span} was busy, but not unusual.",
    rollingQuiet: "<strong>No.</strong> {span} was on the quiet side.",
    rollingAverage: "<strong>No.</strong> {span} was about average.",

    /* The same five answers as fragments, for the table beside the histogram.
       There the range in the next column already supplies the subject, so the
       sentence only has to supply the verdict -- and five full sentences that
       all begin "The last year was" is five times the reading for one word of
       difference. The rolling set above stays intact: it is also the headline,
       where a bare "No -- fewer." would say nothing. */
    /* What {span} and {window} say above: the live view, and a date picked in
       the "Year ending" field, where {date} is that date. */
    spanLive: "The last year",
    spanPast: "The year ending on {date}",
    windowLive: "the last 365 days",
    windowPast: "the 365 days ending on {date}",
    asOfLabel: "Year ending",
    asOfLabelThirty: "30 days ending",
    /** The headline once a date is picked. The live one is in unusual/index.html. */
    questionPast: "Were there more earthquakes than usual in the year ending on {date}?",
    asOfToday: "Back to today",

    /* =================================================================
       THE 30-DAY VIEW. The "Over" switch at the top flips the page between
       the last year and the last 30 days.
       ================================================================= */
    spanLabel: "Over",
    spanYear: "The last year",
    spanThirty: "The last 30 days",
    questionThirty: "Are there more earthquakes than usual right now?",
    questionThirtyPast: "Were there more earthquakes than usual in the 30 days ending on {date}?",
    /** {span} is "The last 30 days" live, or "The 30 days ending on {date}". */
    thirtySpanLive: "The last 30 days",
    thirtySpanPast: "The 30 days ending on {date}",
    thirtyBusiest: "<strong>Yes.</strong> {span} were unusually busy.",
    thirtyQuietest: "<strong>No — fewer.</strong> {span} were unusually quiet.",
    thirtyBusy: "<strong>No.</strong> {span} were busy, but not unusual.",
    thirtyQuiet: "<strong>No.</strong> {span} were on the quiet side.",
    thirtyAverage: "<strong>No.</strong> {span} were about average.",
    /** The sentence under the histogram, as the yearly view has one. */
    thirtyBand:
      "In 90% of 30-day stretches since {from}, there are between {lo} and {hi} " +
      "{threshold} earthquakes. {actual} {often}",
    thirtyActualLive: "In the last 30 days, there have been {n}.",
    thirtyActualPast: "In the 30 days ending on {date}, there were {n}.",
    /** How often a stretch this quiet or busy turns up. {how} is one of the
        thirtyHow* phrases below. */
    thirtyOften: "A 30-day stretch this {which} happens {how}.",
    thirtyNever: "No other 30-day stretch since {from} has been this {which}.",
    thirtyHowTimes: "about {n} times a year",
    thirtyHowOnce: "about once a year",
    thirtyHowFew: "every two or three years",
    thirtyHowRare: "about once every {n} years",
    thirtyQuietWord: "quiet",
    thirtyBusyWord: "busy",
    /** Read by screen readers in place of the histogram. */
    thirtySummary: "{n} {threshold} earthquakes in {window}. Usually there are about {median}.",
    thirtyWindowLive: "the last 30 days",
    thirtyWindowPast: "the 30 days ending on {date}",
    thirtyShareMore: "of 30-day stretches had more",
    thirtyNowLabel: "now",
    thirtyColCount: "Earthquakes in 30 days",
    thirtyScaleNow: "the last 30 days",
    thirtyScaleNowPast: "the 30 days ending on {date}",
    thirtyHistTip: "{n} earthquakes: {share}% of 30-day stretches",
    thirtyRange: "Charts show",
    thirtyTimelineTitle: "Every {threshold} earthquake, with {window} marked",
    thirtyBoxLive: "Last 30 days",
    thirtyBoxPast: "30 days ending on {date}",
    thirtyMainshock: "Mainshock",
    thirtyAftershock: "Aftershock",
    thirtyDotSize: "Dot size follows magnitude",
    thirtyTimelineNote:
      "{window}: {n} {threshold} earthquake{s}, {main} mainshock{ms} and {after} " +
      "aftershock{as}.{largest}",
    thirtyTimelineLargest: " The largest was M{mag}, {place}, on {date}.",
    thirtyRollingTitle: "{threshold} {kind} in each 30-day stretch",
    thirtyRollingNote:
      "Each bar is one 30-day stretch, back to back, so no two share a day. The shading " +
      "is the middle half and the middle 90% of every 30-day stretch since {from}.",
    thirtyLegendLine: "The 30 days being read",
    thirtyLegendEarlier: "Earlier 30-day stretches",
    thirtyLegendInner: "Middle half of all 30-day stretches",
    thirtyLegendOuter: "Middle 90%",

    scaleAnsBusiest: "<strong>Yes.</strong>",
    scaleAnsBusy: "<strong>No.</strong> Busy, but not unusual",
    scaleAnsAverage: "<strong>No.</strong> About average",
    scaleAnsQuiet: "<strong>No.</strong> On the quiet side",
    scaleAnsQuietest: "<strong>No — fewer.</strong>",
    detailCountRolling:
      "{count} {threshold} {kind} in {window} — usual is {median} — {above}% of years " +
      "since {from} had more {kind}",
    detailMomentRolling:
      "{count} released in {window} — as much as a single M{equivalent} earthquake — " +
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
    aggregateHelpBody:
      "A z-score says how far a year sits from the middle, measured in units of the ordinary " +
      "year-to-year spread. Zero is an average year." +
      "\n\nThere are many ways to look at earthquake numbers; we show {waysWord} of them below. " +
      "This z-score combines those {waysWord} into a single representative number.",
    detailNoneCount: "No {threshold} {kind} recorded worldwide yet in {year}.",
    detailNoneMoment: "No moment released worldwide yet in {year}.",

    /* Chart headings. */
    cumulativeTitle: "Cumulative {subject} worldwide",
    cumulativeSubjectCount: "{threshold} {kind}",
    cumulativeSubjectMoment: "moment release from {threshold} earthquakes",
    annualBand:
      "In 90% of years, we expect to see between {lo} and {hi} {threshold} earthquakes. " +
      "{actual}",
    annualBandActualLive: "In the last 365 days, there have been {n}.",
    annualBandActualPast: "In the 365 days ending on {date}, there were {n}.",

    /* Axis labels. */
    axisCumulativeCount: "{threshold} events this year",
    axisCumulativeCountRolling: "{threshold} events, cumulative",
    axisCumulativeMoment: "Moment this year, as a single earthquake",
    axisAnnualCount: "{threshold} earthquakes per year",
    axisAnnualMoment: "Moment per year, as a single earthquake",

    /* The small print under the cumulative chart. */
    noteBand:
      "Each faint line is one of the {years} other years. The inner band spans the middle " +
      "50% of those years and the outer band the middle 90%. A line inside the shading falls " +
      "within the range of other years.",
    noteSigma:
      "Each faint line is one of the {years} other years. The band is the mean plus " +
      "and minus two standard deviations — the range a normal distribution would put " +
      "95.45% of the data in. It is measured over every window of this length anywhere " +
      "in the record, not over the calendar years.",
    noteMoment:
      "Moment measures how much the ground moved, not how often. One great earthquake can " +
      "outweigh a whole ordinary year, so this line can jump in a single afternoon.",
    noteMainshocks:
      "Aftershocks have been removed, so each earthquake sequence counts once.",
    noteLiveUnclassified:
      "{n} event{s} from the last day {was} sorted into mainshocks and aftershocks on this " +
      "page, and will be checked again at the next rebuild.",

    /* The small print under the annual chart. Two versions: the M7+ share line
       is meaningless when M7+ is the selected threshold, since it would then be
       the whole bar. */
    /* In the rolling view every bar is a complete twelve months, including the
       current one, so there is nothing to project. */
    noteAnnualRolling: "Each bar covers the 365 days ending {when}.",
    noteAnnualRollingMajor: "",
    noteAnnualPlain:
      "{year} is still going: the solid bar shows the year so far, and the dashed outline is " +
      "where it will land if it continues at the usual pace.",
    noteAnnual:
      "The darker part of each bar is the {major} share. {year} is still going: the solid bar " +
      "shows the year so far, and the dashed outline is where it will land if it continues at the usual pace.",

    /* The map and the year list beside it. */
    largestEmpty: "No {threshold} {kind} recorded in {years}.",
    largestTruncated: "{n} {threshold} {kind} — showing the first {shown}.",
    largestFailed: "Could not load event details.",
    readAnalysis: "Read our analysis →",

    /* Legend and controls. */
    legendOtherYears: "Other years, since {from}",
    legendMedian: "Average year (median)",
    legendBand: "Middle 90% of past years",
    legendBandInner: "Middle half of past years",
    legendMean: "Average year (mean)",

    /* Earthquakes, not percentiles: the frequency column already says what a
       percentile band means, and "5 years in 100" is easier to hold than "the
       95th percentile". */
    scaleRow: "{lo} to {hi}",
    scaleRowLow: "{n} or fewer",
    scaleRowHigh: "{n} or more",
    scaleNow: "{year}, right now",
    scaleNowPast: "{year}, ending on {date}",
    scaleColCount: "Earthquakes in the last year",
    scaleColCountPast: "Earthquakes in the year",
    scaleColAnswer: "The answer",
    scaleBasis: "Calculated based on all {threshold} earthquakes worldwide since {from}",
    legendSigma: "±2σ — 95.45% under a normal fit",
    yearsNone: "None",
    yearsSome: "{n} years",
    yearsCount: "{n} of {max}",

    /* Every one of these leads with the combined number, because that is the
       one the answer is graded on. The steepest single series is named
       afterwards, as context -- naming it first would put the un-corrected
       p-value in the reader's head as the result. */
    /* ===============================================================
       THE TECHNICAL SUMMARY, front page. Plain and direct: what the
       data is, what was done to it, and what that costs.
       =============================================================== */
    techTitle: "Technical summary",
    techBody:
      "**Where the data come from.** Every earthquake here is from the USGS ComCat catalog, " +
      "pulled through the FDSN event service. Quarry blasts, explosions and other " +
      "non-tectonic events are excluded. The catalog is rebuilt several times a day, and your " +
      "browser reads the USGS feed of the last day directly, so an earthquake from an hour " +
      "ago is already counted here." +

      "\n\n**How the answer at the top is decided.** One fixed reading, and the controls " +
      "cannot move it: {threshold} earthquakes, aftershocks included, counted over the 365 " +
      "days ending today, and ranked against the same 365-day stretch of every year back to " +
      "{from}. The histogram under the answer draws those past windows, so the bar the " +
      "marker sits on is the count the sentence is about. The 30-day view reads the same " +
      "series over 30 days. In both, selecting {major} or mainshocks changes the charts " +
      "below; it does not change the answer." +

      "\n\n**The five answers, and where their edges are.** The table beside the histogram " +
      "is a fixed scale, not a reading: it says what this page would answer for any count, " +
      "and the row it marks is the one the last year falls in. The edges are the 5th, 25th, " +
      "75th and 95th percentiles of the past windows, so the middle band is half of all " +
      "years and the two outer ones are five years in a hundred each. Because they are " +
      "percentiles of the record rather than fixed numbers, they move as the record grows. " +
      "The counts printed in the table are those percentiles rounded to whole earthquakes. " +
      "In the 30-day view, where counts are small, each whole count is put through the same " +
      "rule that picks the answer, so the row the table marks always matches the answer." +

      "\n\n**A year here is 365 days ending today.** Comparing a part-finished calendar " +
      "year against whole ones would flatter or punish it depending on the date, so the " +
      "default everywhere is a full twelve months ending today, measured against windows " +
      "that ended on the same date in earlier years. The cumulative chart can be switched to " +
      "the calendar year, which is then compared against the same date in every past year. " +
      "The chart of yearly counts is always 365-day windows, so every bar on it is complete " +
      "and directly comparable." +

      "\n\n**Other dates.** The date field moves the whole page to the year, or the 30 " +
      "days, ending on any day since 1977. That year is then ranked against every other " +
      "complete year in the record, after it as well as before, so a year in the 1980s is " +
      "judged against as many others as this one is. The live feed is left out, since it " +
      "only covers the last day." +

      "\n\n**The last 30 days.** The switch at the top turns the page to the last 30 " +
      "days. A 30-day stretch is not compared with the same 30 days in each earlier year, " +
      "which would give one peer per year at around a dozen earthquakes each. It is ranked " +
      "against every other 30-day stretch since {from}: one ending on each day, about " +
      "18,000, leaving out any that overlap it. Earthquakes keep no calendar, so a stretch " +
      "in March is a fair comparison for one in October. \"How often\" counts separate " +
      "spells rather than days: a quiet spell keeps the count low for days on end as the " +
      "window slides, so qualifying days within 30 of each other count once." +

      "\n\n**Magnitudes are converted to Mw.** Moment magnitude, or Mw, is the gold standard " +
      "for measuring earthquake size. However, before around 1984, the USGS used other kinds " +
      "of magnitudes for some earthquakes. Here, we replace those alternative magnitudes with " +
      "Mw where we can, to make earthquakes comparable across years. We use W-phase first, " +
      "then GCMT centroid, then body-wave, then any other Mw — and fall back only where none " +
      "exists. About {mwShare}% of {threshold} events carry an Mw." +

      "\n\n**Aftershocks can be removed.** A year containing one great earthquake carries " +
      "hundreds of smaller ones with it. **Mainshocks only** removes them. The operation is " +
      "called declustering, and this site uses the nearest-neighbour method of Zaliapin and " +
      "Ben-Zion. Each earthquake is linked to the earlier earthquake closest to it in a " +
      "measure that combines time, distance (in three dimensions, so depth counts) and the " +
      "earlier one's magnitude. Across the catalog these links fall into two clear groups, " +
      "aftershocks sitting close to a large parent and background earthquakes scattered " +
      "independently, and the dividing line between them is fitted to the data rather than " +
      "set by hand. It runs on {threshold} and up, where the catalog is complete since " +
      "{from}. An earthquake is removed only if it links back to an earlier one at least as " +
      "large, so nothing is ever removed because of an earthquake that came after it, and " +
      "this year is sorted exactly as every earlier year was. Earthquakes from the live feed " +
      "are sorted the same way in your browser, and checked again at the next rebuild." +

      "\n\n**The record starts in {from},** when the Global CMT catalog begins — the earliest " +
      "date from which moment magnitudes are broadly available. Only {threshold} and {major} " +
      "are offered: below M6, how many earthquakes a year contains depends partly on how many " +
      "seismometers were running that year, so counts cannot be compared across decades." +

      "\n\n**The shaded ranges.** The bands on the cumulative chart show where the middle " +
      "50% and middle 90% of past windows fell on each day of the window.",

    /* Footer and failures. */
    latest: "latest {threshold}: {when}, M{mag} {place}",
    generated: "Catalog snapshot built {when}; live events appended from the USGS one-day feed.",
    errorCatalog: "Could not load the catalog: {message}",
    errorNoHistory: "Not enough history yet to draw a reference range.",
    errorBoot:
      "{message}. Run the pipeline first: python3 pipeline/fetch.py --backfill && " +
      "python3 pipeline/magnitudes.py && python3 pipeline/decluster.py && python3 pipeline/build.py",
  },

  /* ===================================================================
     THE CORRELATIONS PAGE
     =================================================================== */
  correlations: {
    answer: "<strong>No.</strong>",
    detail: "We checked. The data below updates as the USGS catalog does, and every answer on "
      + "this page is computed from it rather than hard-coded.",
    /* The page's own answer, on the same three rungs as the panels. The
       smallest of the four p-values in the family decides which, but only
       after correcting for having asked four questions -- and the correction
       lands on the same 1% and 5% lines, since 1 - (1 - 0.0127)^4 is 5%. The
       weekday panel is shown and graded but not in the family; see TESTS in
       correlations.ts. */
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
    /* The per-question table, left of the combined one, and it lists all five
       including the weekday check. Someone who came for one of them wants that
       one answered, not averaged into the others: the combined number is the
       right way to read the page as a whole and the wrong way to answer "do
       sunspots cause earthquakes". */
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
      "count of earthquakes, so they were checked together, once, by shuffling the years: " +
      "the correlation between them came out at about 0.01, close enough to zero to treat " +
      "them as independent.",

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
      "non-results at worst. A few careful studies do find an effect on a small number of " +
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
    /* Empty on purpose. The verdict above the panel already says no, and the
       chart shows the scatter; restating it with a correlation coefficient
       added nothing a reader of this panel had asked for. climateStatNull is
       kept because the technical summary still quotes the same figures. */
    climateCloseNo: "",
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
      "non-tectonic events are excluded. The catalog is rebuilt several times a day. The three " +
      "binned panels use everything in it, up to and including the incomplete current year; " +
      "the two yearly comparisons use complete years only." +

      "\n\n**Magnitudes are converted to Mw.** Moment magnitude, or Mw, is the gold standard " +
      "for measuring earthquake size. However, before around 1984, the USGS used other kinds " +
      "of magnitudes for some earthquakes. Here, we replace those alternative magnitudes with " +
      "Mw where we can, to make earthquakes comparable across years. We use W-phase first, " +
      "then GCMT centroid, then body-wave, then any other Mw — and fall back only where none " +
      "exists. About {mwShare}% of {threshold} events carry an Mw. Only about {binMwShare}% " +
      "of {binThreshold} events do, because the search for published Mw values reaches down " +
      "only to M5.5: below that, the {binThreshold} panels use ComCat's preferred magnitude, " +
      "which for recent earthquakes is usually a moment magnitude already." +

      "\n\n**Aftershocks are removed.** A year containing one great earthquake carries " +
      "hundreds of smaller ones with it. They are removed everywhere on this page except the " +
      "Oklahoma panel, which counts every earthquake. The operation is called declustering, " +
      "and it is done two ways. The two yearly comparisons, at {threshold}, use the " +
      "nearest-neighbour method of Zaliapin and Ben-Zion, as the front page does: each " +
      "earthquake is linked to the earlier one closest to it in time, three-dimensional " +
      "distance and magnitude, with the cut between aftershocks and background fitted to the " +
      "data. The three binned panels, at {binThreshold}, still use Gardner-Knopoff windows: " +
      "an earthquake is removed if an earlier one at least as large lies within a set " +
      "distance and time of it, the distance widened to twice the Wells and Coppersmith " +
      "rupture length at large magnitudes and the time running two and a half to three " +
      "years at M6.5 and above. Those windows remove more than they should, but a binned " +
      "panel compares bins against each other, so what they remove falls evenly across the " +
      "bins. Both methods work forward in time only." +

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
      "exact distributions to within a few thousandths over the range used here." +

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
      "checked against each other once, by shuffling the years." +

      "\n\n**The day of the week is not one of the {testsWord}.** It is a calibration test: " +
      "earthquakes cannot know what day it is, so a result there would say something about " +
      "how the catalog is assembled rather than about the Earth. It is shown, and graded on " +
      "its own p-value, but it is left out of the combined figure — counting it would hold " +
      "the {testsWord} real questions to a stricter standard to guard against an answer " +
      "nobody is looking for." +

      "\n\n**A p-value is not the probability that there is no pattern.** It is how often " +
      "chance alone would produce a result this strong. It also says nothing about size: with " +
      "{kept} earthquakes, a difference of a few percent, depending on how many bins it is " +
      "spread over, is enough to pass a 5% cutoff. A result that crosses is worth looking at, not a finding." +

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
