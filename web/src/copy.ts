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
    verdictYesNegligible: "Yes, but the effect is negligible.",
    verdictNotReally: "Not really.",
    /* The furthest bar, and how many stray bars to expect anyway. Said in one
       breath, because saying "inside the grey" and then "one bar is outside"
       about the same bar reads as a contradiction. */
    /** Appended once the tally is stated, to say what it means. The band is
        built on the null hypothesis, so it is right to name the null. */

    /* Verdict lines shared by the scatter panels. */
    verdictMaybe: "Maybe, but only just.",
    verdictNotEnough: "Not enough data.",

    /* What each test would have to read for the answer above it to change. The
       page says its answers are computed; these lines are that claim in a form
       a reader can hold against the next update. */
    /* The table under each panel: what the test would have to read for the
       answer above it to change, and where it currently reads. The verdict
       column reuses the verdict strings themselves, so the table cannot
       describe a rule the page does not follow. */
    flipTitle: "This answer is calculated, not hard-coded:",
    flipHelp: "what is chi-square?",
    flipHelpBody:
      "There are {bins} bins above, holding {total} earthquakes between them. If the thing " +
      "on the horizontal axis made no difference at all, you would expect about {expected} " +
      "in each. They will never come out exactly equal — nothing random does." +
      "\n\nChi-square is one number for how far off the bins are, all together. For each bin " +
      "it takes the gap between what turned up and what was expected, squares it so that " +
      "overshoots and undershoots cannot cancel out, and divides by the expected count so a " +
      "bin expected to be large is allowed to miss by more. Then it adds those up." +
      "\n\nA small total means the gaps are the size chance produces. A large one means they " +
      "are bigger than chance explains. The threshold is the value that random data exceeds " +
      "only 5% of the time." +
      "\n\nOne catch, and it is why this page checks the size of the difference as well: the " +
      "threshold does not grow with the amount of data. On {total} earthquakes a difference " +
      "of a few percent clears it comfortably. Passing the test means a difference is " +
      "detectable, not that it is large.",
    flipBinBelow: "chi-square below {critical}",
    flipBinNegligible: "above {critical}, but the difference is tiny",
    flipBinMeaningful: "above {critical}, and big enough to matter",
    flipBinNow: "right now: {statistic}",
    flipScatterAbove: "correlation above +{critical}",
    flipScatterWithin: "correlation between ±{critical}",
    flipScatterBelow: "correlation below −{critical}",
    flipScatterNow: "right now: {r}",

    weekdayQuestion: "Do earthquakes prefer a day of the week?",
    weekdayExplain:
      "We took every {threshold} earthquake recorded since {from} — {raw} of them — " +
      "and removed the aftershocks, leaving {count} independent earthquakes. Then we " +
      "classified each of those by its day of the week in UTC." +
      "\n\nMore earthquakes occur on {bin}s, at {percent}% above the average. So, are {bin}s " +
      "earthquake days? No; that kind of variation is within the range of what we expect if the " +
      "distribution is random. On the plot, the gray shows ±2 standard deviations — i.e., where " +
      "we expect 95.45% to fall.",
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
    monthSubtitle: "Month of the year · {since}",

    moonQuestion: "Does the moon set off earthquakes?",
    moonVerdict: "No.",
    /* {allBut} is filled from the data, so the count cannot go stale, and the
       link is built from one URL held in correlations.ts. */
    moonExplain:
      "Many people have suggested that lunar tides might cause earthquakes — this is a topic " +
      "that has shown up not just in popular culture, but research papers. Here, we show those " +
      "same {count} earthquakes, classified by the lunar day on which each occurred. This chart " +
      "tests the question as " +
      "it is usually asked: does the count depend on the phase of the moon? If it did, the " +
      "simplest expectation is two peaks, at new and full moon, when the sun and moon pull " +
      "together. That pattern does not show up. Instead, {allBut} the data points fall within " +
      "±2 standard deviations — i.e., where we expect 95.45% of the data to fall if it is random." +
      "\n\nAs with many things, it is possible to make this question much more complicated — " +
      "looking at different types of stresses, different types of faults, different regions on " +
      "Earth. All of those studies for global earthquakes show ambiguous results at best, and " +
      "non-results at worst. A few careful studies do find a small effect on a small number of " +
      "very sensitive faults, mostly in regions with high subsurface fluid pressures." +
      "\n\nSome people have suggested that tides can be used to predict earthquakes. We tested " +
      "the published claims of tidal precursors directly, and they " +
      "<a href=\"{article}\" data-track=\"substack-tides\" target=\"_blank\" " +
      "rel=\"noopener noreferrer\">did not hold up</a>.",
    moonAllInside: "all of",
    moonAllBut: "all but {n} of",
    moonSubtitle: "Day of the lunar cycle · {since}",
    moonNewMoon: "new moon",
    moonFullMoon: "full moon",

    climateQuestion: "Is climate change causing earthquakes?",
    climateExplain:
      "Some people have suggested that climate change might cause earthquakes to become more " +
      "frequent — suggesting that melting ice, rising sea level, and changes in hydrology could " +
      "affect the rate of earthquakes. While these things can affect earthquakes, the effects " +
      "are very small, and there is no evidence that they cause an effect that rises above the " +
      "level of the noise." +
      "\n\nBelow, we show the number of {threshold} earthquakes per year, again with the " +
      "aftershocks removed, plotted against the global temperature in that year. Why {threshold} " +
      "instead of {binThreshold}? Earthquake networks have improved over time, so we can detect " +
      "earthquakes now that we could not detect in the 1970s. Because we're looking at " +
      "year-over-year trends here, those kinds of changes in detectability could look like real " +
      "signal. Fortunately, networks have been good enough since {from} to detect all global " +
      "{threshold} earthquakes." +
      "\n\nAs before, we remove aftershocks, so our initial catalog of {tierRaw} decreases to " +
      "{tierCount}, which is plenty for this analysis. As expected, we see no change. {stat}",
    /* Two versions of the statistic, so the sentence stays true if the
       correlation ever clears the threshold. */
    climateStatNull:
      "The correlation coefficient over {years} years is {r}, well below the {critical} we " +
      "would need for statistical significance at the 5% level.",
    climateStatSignificant:
      "The correlation coefficient over {years} years is {r}, which exceeds the {critical} " +
      "needed for statistical significance at the 5% level. With this few years, treat that as " +
      "suggestive rather than established.",
    climateYesUp: "Yes — more earthquakes in warmer years.",
    climateYesDown: "Yes — fewer earthquakes in warmer years.",
    climateAxis: "Global temperature (°C above 1951–1980)",

    solarQuestion: "Does solar activity trigger earthquakes?",
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
      "The correlation coefficient is {r}, which does reach the {critical} needed for " +
      "statistical significance at the 5% level. On {years} years of data, treat that as " +
      "suggestive rather than established.",
    solarYesUp: "Yes — earthquakes happen more often in years with more solar activity.",
    solarYesDown: "Yes — earthquakes happen less often in years with more solar activity.",
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
    oklahomaLegendRate: "Normal rate before 2009 — about {rate} a year",

    sources: "Data: {list}.",
    errorLoad: "Could not load the data.",
  },
} as const;
