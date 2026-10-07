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
} as const;
