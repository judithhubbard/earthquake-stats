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
    stripAxisCount: "{threshold} {kind} by {date}, each year {from}–{to}",
    stripAxisCountRolling: "{threshold} {kind} in a year, each year {from}–{to}",
    /* The moment axis is drawn as the magnitude of the single earthquake that
       would release the year's moment. Raw moment spans a factor of a hundred
       and is unreadable; this is the same number the answer sentence quotes. */
    stripAxisMoment:
      "Moment released by {date}, as the equivalent of a single earthquake · {from}–{to}",
    stripAxisMomentRolling:
      "Moment released in a year, as the equivalent of a single earthquake · {from}–{to}",
    stripCurrent: "{year}: {count}",
    stripCurrentMoment: "{year}: M{count}",
    stripShare: "{share}%",
    stripShareMore: "of years had more",
    stripShareLess: "of years had less",

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
      "in the record, not over the calendar years: taking it year by year makes a single " +
      "huge earthquake enter the calculation on its own anniversary, and the band visibly " +
      "steps on 11 March, the date of Tohoku. Sliding the window spreads that event over " +
      "every window containing it, which is what asking how much a year's worth varies " +
      "actually means.",
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
      "The answer is chosen automatically by comparing earthquakes this year to past " +
      "years. Right now {threshold} {kind} put {year} at the {percentile} percentile.",
    legendSigma: "±2σ — 95.45% under a normal fit",
    yearsNone: "None",
    yearsSome: "{n} years",
    yearsCount: "{n} of {max}",

    /* Footer and failures. */
    generated: "Catalog snapshot built {when}; live events appended from the USGS one-day feed.",
    errorCatalog: "Could not load the catalog: {message}",
    errorNoHistory: "Not enough history yet to draw a reference range.",
    errorBoot:
      "{message}. Run the pipeline first: python3 pipeline/fetch.py --backfill && " +
      "python3 pipeline/magnitudes.py && python3 pipeline/decluster.py && python3 pipeline/build.py",
    errorBasemap: "Could not load the basemap.",
  },

  /* ===================================================================
     THE AFTERSHOCKS PAGE
     =================================================================== */
  aftershocks: {
    answer: "<strong>Yes.</strong> It is the strongest pattern in the whole subject.",
    detail:
      "Nothing else on this site comes close. An earthquake makes another earthquake nearby " +
      "far more likely — for a while, and in a way that follows a rule you can write down.",

    stackQuestion: "What happens around a big earthquake?",
    stackVerdict: "Everything changes, and not symmetrically.",
    stackExplain:
      "This is {anchors} large earthquakes laid on top of each other, lined up on the moment " +
      "each one struck, counting the earthquakes nearby day by day. One sequence on its own is " +
      "a story. Six hundred stacked is a law." +
      "\n\nOrdinarily this patch of ground produces an earthquake about once every " +
      "{backgroundPeriod} weeks. On the day of the big one it produces {peak}. Notice the " +
      "scale on the left climbs by factors of ten rather than in even steps, so a gentle-" +
      "looking slope is really a collapse." +
      "\n\nLook to the left of the line too. The rate is already creeping up days beforehand.",
    stackSubtitle: "Earthquakes per day within {radius} km, {days} days either side",
    stackAxis: "Earthquakes per day",
    stackMarker: "the big one",

    decayQuestion: "How long do aftershocks last?",
    decayVerdict: "They fade, but slowly, and by a rule.",
    decayExplain:
      "Aftershocks die away roughly in proportion to one over the time elapsed. An hour after " +
      "the mainshock they arrive about ten times faster than ten hours after, and ten times " +
      "faster again than a hundred hours after. On a chart where both scales climb by factors " +
      "of ten, that rule is a straight line — and here it is." +
      "\n\nThis is Omori's law, written down in 1894 and still one of the few things in " +
      "seismology you can set your watch by. Fitted to this data the slope comes out at {p}, " +
      "against the 1.0 of a perfect one-over-time." +
      "\n\nIt also means aftershocks never quite stop. They just become too rare to notice.",
    decaySubtitle: "Days after the mainshock (both scales by factors of ten)",
    decayAxisX: "Days after",
    decayAxisY: "Earthquakes per day",
    decayReference: "one over time",

    examplesQuestion: "Do big earthquakes warn you first?",
    examplesVerdict: "Sometimes. Not reliably.",
    examplesExplain:
      "Two of the largest earthquakes ever recorded, drawn the same way. One spent weeks " +
      "rumbling before it broke. The other arrived out of a clear sky." +
      "\n\nAbout {half}% of earthquakes turn out to have come shortly before a bigger one " +
      "nearby — foreshocks, but only in hindsight. The trouble is the other {rest}%, which look " +
      "exactly the same at the time and are never followed by anything bigger. That is the " +
      "difficulty of earthquake prediction in one number.",
    exampleWith: "{mag} · {place}",
    exampleForeshocks: "{n} earthquakes in the 30 days before",
    exampleNone: "nothing in the 30 days before",
    examplesAxis: "Earthquakes per day",
    examplesSubtitle: "Earthquakes per day within {radius} km, {days} days either side",

    method:
      "Earthquakes of magnitude {minMagnitude} and up, within {radius} km of a magnitude " +
      "{anchorMagnitude} or larger mainshock. The foreshock figures count any earthquake " +
      "followed within {foreshockDays} days, and {foreshockKm} km, by one at least half a " +
      "magnitude larger. Every number on this page moves if you change those choices, which " +
      "is why they are written here.",
    errorLoad: "Could not load the data.",
  },

  /* ===================================================================
     THE CORRELATIONS PAGE
     =================================================================== */
  correlations: {
    answer: "<strong>No.</strong>",
    detail: "We checked. The data below updates as the USGS catalog does, and every answer on this page is computed from it rather than hard-coded.",

    legendBand: "±2σ band — should contain 95.45%",
    legendAbove: "More earthquakes than average",
    legendBelow: "Fewer than average",
    subtitleSince: "Magnitude {threshold} and up, since {from}",

    /* Verdict lines shared by the bar panels. */
    verdictNo: "No.",
    verdictYes: "Yes.",
    verdictMaybe: "Maybe.",
    verdictNotReally: "Not really.",
    /* The furthest bar, and how many stray bars to expect anyway. Said in one
       breath, because saying "inside the grey" and then "one bar is outside"
       about the same bar reads as a contradiction. */
    /** Appended once the tally is stated, to say what it means. The band is
        built on the null hypothesis, so it is right to name the null. */

    /* Verdict lines shared by the scatter panels. */
    verdictNotEnough: "Not enough data.",

    /* Shown when a test passes its threshold. Passing at the 5% level is not a
       finding, and this is the sentence that says so. */
    maybeBin:
      "The data do show a pattern. Does a pattern mean a cause? If earthquakes occur at " +
      "random, we would expect to see a spread like this {p}% of the time. So this is not a " +
      "full answer, but it suggests the data are worth a deeper look.",
    maybeScatter:
      "The data do show a correlation. Does correlation equal causation? If earthquakes occur " +
      "at random, we would expect to see a correlation like this {p}% of the time. So this is " +
      "not a full answer, but it suggests the data are worth a deeper look.",

    /* What each test would have to read for the answer above it to change. The
       page says its answers are computed; these lines are that claim in a form
       a reader can hold against the next update. */
    /* The table under each panel: what the test would have to read for the
       answer above it to change, and where it currently reads. The verdict
       column reuses the verdict strings themselves, so the table cannot
       describe a rule the page does not follow. */
    flipTitle: "This answer is calculated, not hard-coded:",
    flipHelp: "what is chi-square?",
    flipHelpR: "what is a correlation coefficient?",
    flipHelpV: "what is Cramér's V?",
    flipHelpVBody:
      "Cramér's V measures how large the unevenness is, rather than how confidently it can be " +
      "told apart from chance." +
      "\n\nIt runs from 0 to 1. At 0 the bars are exactly level. The larger it gets, the " +
      "further from level they are." +
      "\n\nChi-square grows with the amount of data: given enough earthquakes, a difference of " +
      "a fraction of a percent will pass its threshold. V does not. It stays the same size as " +
      "the data accumulate, so it answers whether a difference is worth caring about rather " +
      "than whether it can be detected." +
      "\n\nAnything below 0.1 is conventionally treated as negligible.",
    flipHelpRBody:
      "The correlation coefficient is one way to assess whether two quantities move together, " +
      "or vary independently." +
      "\n\nIt runs from −1 to +1. At 0, knowing one value tells you nothing about the other. " +
      "Near +1, the two rise and fall together. Near −1, one rises as the other falls." +
      "\n\nThe threshold in the rows below is the value that {years} pairs of unrelated " +
      "numbers exceed only 5% of the time. A correlation weaker than that is the size " +
      "unrelated quantities produce on their own." +
      "\n\nThis threshold does move, unlike the chi-square one. It is set by how many years " +
      "there are, and tightens as they accumulate: ±{critical} at {years} years, about ±0.23 " +
      "at seventy-five. More data makes a weaker relationship detectable." +
      "\n\nIt measures straight-line relationships only, and says nothing about which " +
      "quantity would be influencing which.",
    flipHelpBody:
      "Chi-square is one way to assess whether the wobble above is random, or reflects a real " +
      "pattern." +
      "\n\nEach bar is compared with the count it would hold if there were no pattern at all. " +
      "Those differences are combined into a single number. The larger the differences, the " +
      "larger the number." +
      "\n\nWhat counts as large depends on how many bars there are. If the data are random, " +
      "we expect the chi-square to exceed the threshold only 5% of the time." +
      "\n\nThe threshold never moves. It is set by the number of bars alone, so more " +
      "earthquakes will not change it. Only the chi-square moves, as new earthquakes occur and " +
      "are added to the dataset.",
    /* Column headings, then the conditions in each. A row is one combination
       of them, and the values underneath sit in the column they are compared
       against -- classifying a difference as negligible while never showing
       the number that decides it would be the sort of thing this page argues
       against. */
    flipColChi: "Chi-square",
    flipColSize: "Cramér's V",
    flipColR: "Correlation (r)",
    flipColAnswer: "The answer",
    flipBinAbove: "above {critical}",
    flipBinBelow: "below {critical}",
    flipVAbove: "{v} or more",
    flipVBelow: "below {v}",
    flipVAny: "—",
    flipScatterAbove: "above +{critical}",
    flipScatterWithin: "between ±{critical}",
    flipScatterBelow: "below −{critical}",
    flipNow: "Right now: {value}",

    weekdayQuestion: "Do earthquakes prefer a day of the week?",
    /* The first paragraph is the method and holds whatever the answer is; the
       rest depends on it, so the two are separate strings. */
    weekdayIntro:
      "We took every {threshold} earthquake recorded since {from} — {raw} of them — " +
      "and removed the aftershocks, leaving {count} independent earthquakes. Then we " +
      "classified each of those by its day of the week in UTC.",
    weekdayTail:
      "More earthquakes occur on {bin}s, at {percent}% above the average. So, are {bin}s " +
      "earthquake days? No — with seven days, one of them is always the busiest, and {percent}% " +
      "is the sort of margin that produces. On the plot, the gray shows ±2 standard deviations " +
      "— i.e., where we expect 95.45% to fall.",
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

    monthQuestion: "Do earthquakes have a season? Is there such a thing as earthquake weather?",
    /* Values are filled from the data. The "right next to" line only holds while
       the two largest deviations are adjacent months, so there is a fallback. */
    monthIntro:
      "We classified the same {count} independent earthquakes by the month each one occurred " +
      "in. {inside} Here we show the rate of earthquakes per day within the month, since months " +
      "have different days.",
    monthAllInside:
      "All months fall within ±2 standard deviations — i.e., where we expect 95.45% of the data " +
      "to fall if it is random.",
    monthSomeOutside:
      "{n} of the 12 months fall outside ±2 standard deviations — the range where we expect " +
      "95.45% of the data to fall if it is random.",
    monthPairAdjacent:
      "The largest deviation is {bin1}, which has {pct1}% {dir1} earthquakes than average. That " +
      "might sound suspicious, but it sits right next to the second-largest deviation ({bin2}), " +
      "with {pct2}% {dir2} earthquakes than average! There is nothing to see here.",
    monthPairApart:
      "The largest deviation is {bin1}, which has {pct1}% {dir1} earthquakes than average, and " +
      "the second-largest ({bin2}) runs {pct2}% {dir2}. There is nothing to see here.",
    monthExplain:
      "Here, month is a proxy for weather. If weather had a noticeable impact on earthquake " +
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
      "the month makes no difference." +
      "\n\nThat is worth a look, but it is not yet a reason to think weather drives " +
      "earthquakes. Earthquakes typically start ten kilometers or more underground, where the " +
      "small stresses caused by weather patterns have essentially no impact." +
      "\n\nThere are a few locations where there are slight differences between earthquake " +
      "rates between summer and winter, but they are rare and associated with large swings, " +
      "like the South Asian monsoon.",
    monthSubtitle: "Month of the year · {since}",

    moonQuestion: "Does the moon set off earthquakes?",
    moonVerdict: "No.",
    /* {allBut} is filled from the data, so the count cannot go stale, and the
       link is built from one URL held in correlations.ts. */
    /* Split three ways: the setup, the part that depends on the answer, and the
       two paragraphs that follow whatever it is. Duplicating the last two to
       make a second whole string would have meant editing both forever. */
    moonOpen:
      "Many people have suggested that lunar tides might cause earthquakes — this is a topic " +
      "that has shown up not just in popular culture, but research papers. Here, we show those " +
      "same {count} earthquakes, classified by the lunar day on which each occurred. This chart " +
      "tests the question as it is usually asked: does the count depend on the phase of the " +
      "moon? If it did, the simplest expectation is two peaks, at new and full moon, when the " +
      "sun and moon pull together.",
    moonTail:
      "That pattern does not show up. Instead, {allBut} the data points fall within ±2 standard " +
      "deviations — i.e., where we expect 95.45% of the data to fall if it is random.",
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
      "That pattern is not what shows up, but the counts are more uneven than chance " +
      "comfortably explains: a spread like this turns up {p}% of the time when the lunar day " +
      "makes no difference." +
      "\n\nWhether that unevenness has the shape the tidal argument predicts is a separate " +
      "question, and one this chart cannot settle on its own.",
    moonAllInside: "all of",
    moonAllBut: "all but {n} of",
    moonSubtitle: "Day of the lunar cycle · {since}",
    moonNewMoon: "new moon",
    moonFullMoon: "full moon",

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
      "signal. Fortunately, networks have been good enough since {from} to detect all global " +
      "{threshold} earthquakes." +
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
      "The correlation coefficient over {years} years is {r}, well below the {critical} we " +
      "would need for statistical significance at the 5% level.",
    climateStatSignificant:
      "The correlation coefficient over {years} years is {r}, which exceeds the {critical} " +
      "needed for statistical significance at the 5% level.",
    climateYesUp: "Maybe — more earthquakes in warmer years.",
    climateYesDown: "Maybe — fewer earthquakes in warmer years.",
    climateAxis: "Global temperature (°C above 1951–1980)",

    solarQuestion: "Does solar activity affect earthquakes?",
    solarExplain:
      "There is a popular hypothesis that solar activity causes earthquakes. We checked, just to " +
      "make sure. The plot below uses the same {tierCount} independent {threshold} earthquakes, " +
      "one count per year, plotted against the number of sunspots. {stat}",
    /* This one runs closer to the threshold than the climate panel, so the
       second version is not hypothetical. */
    solarStatNull:
      "As expected, the correlation coefficient is {r}; it does not reach the {critical} needed " +
      "for statistical significance at the 5% level.",
    solarStatSignificant:
      "The correlation coefficient is {r}, which reaches the {critical} needed for statistical " +
      "significance at the 5% level.",
    solarYesUp: "Maybe — more earthquakes in years with more sunspots.",
    solarYesDown: "Maybe — fewer earthquakes in years with more sunspots.",
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
    errorLoad: "Could not load the data.",
  },
} as const;
