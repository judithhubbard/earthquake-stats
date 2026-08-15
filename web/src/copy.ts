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
      "{count} {threshold} {kind} worldwide in the last 365 days, against a median of {median} " +
      "for the same stretch in earlier years — the {percentile} percentile of {from}–{to}.",
    detailMomentRolling:
      "{count} released worldwide in the last 365 days — as much as a single M{equivalent} " +
      "earthquake — against a median of {median}. The {percentile} percentile of {from}–{to}.",

    /** The sentence under the answer. */
    detailCount:
      "{count} {threshold} {kind} worldwide so far, against a median of {median} for this " +
      "date — the {percentile} percentile of {from}–{to}.",
    detailMoment:
      "{count} released worldwide so far — as much as a single M{equivalent} earthquake — " +
      "against a median of {median} for this date. The {percentile} percentile of {from}–{to}.",
    detailNoneCount: "No {threshold} {kind} recorded worldwide yet in {year}.",
    detailNoneMoment: "No moment released worldwide yet in {year}.",

    /* Chart headings. */
    cumulativeTitle: "Cumulative {subject} worldwide — against {from}–{to}",
    cumulativeSubjectCount: "{threshold} {kind}",
    cumulativeSubjectMoment: "moment release from {threshold} earthquakes",
    annualTitleCount: "{threshold} {kind} per year, worldwide",
    annualTitleMoment: "Moment released per year, worldwide",
    mapTitle: "{threshold} earthquakes, selected years",

    /* Axis labels. */
    axisCumulativeCount: "{threshold} events this year",
    axisCumulativeMoment: "Moment this year (×10²⁰ N·m)",
    axisAnnualCount: "{threshold} events per year",
    axisAnnualMoment: "Moment per year (×10²⁰ N·m)",

    /* The small print under the cumulative chart. */
    noteBand:
      "Each faint line is one of the {years} previous years. The darker band spans the middle " +
      "50% of those years and the lighter band the middle 90%. A line inside the shading falls " +
      "within the range of previous years.",
    noteMoment:
      "Moment measures how much the ground moved, not how often. One great earthquake can " +
      "outweigh a whole ordinary year, so this line can jump in a single afternoon.",
    noteMainshocks:
      "Aftershocks have been removed, so each earthquake sequence counts once. Deciding which " +
      "events belong to a sequence is a judgement call, and different choices give different counts.",
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
    largestEmpty: "No {threshold} {kind} recorded in {year}.",
    largestNote: "{n} {threshold} {kind} · each links to its USGS event page.",
    largestTruncated: "{n} {threshold} {kind} — showing the first {shown} · each links to its USGS event page.",
    largestNoDetail: "No event details available at this magnitude.",
    largestFailed: "Could not load event details.",
    readAnalysis: "Read our analysis →",

    /* Legend and controls. */
    legendOtherYears: "Other years, {from}–{to}",
    legendMedian: "Reference median",
    legendBand: "Middle 90% of past years",
    legendBandInner: "Middle half of past years",
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
    detail: "Each one checked against {count} earthquakes since {from}.",

    guide:
      "<strong>How to read these charts.</strong> Earthquakes do not arrive evenly, so counts " +
      "vary between groups even when nothing is driving them. The grey band is ±2 standard " +
      "deviations, which should contain 95.45% of the data. Points inside it are consistent " +
      "with random variation. About 1 in 20 will fall outside even when there is no effect, so " +
      "a single point beyond the band is expected rather than surprising.",

    legendBand: "±2σ band — should contain 95.45%",
    legendAbove: "More earthquakes than average",
    legendBelow: "Fewer than average",
    subtitleSince: "Magnitude {threshold} and up, since {from}",

    /* Verdict lines shared by the bar panels. */
    verdictNo: "No.",
    verdictNotReally: "Not really.",
    /* The furthest bar, and how many stray bars to expect anyway. Said in one
       breath, because saying "inside the grey" and then "one bar is outside"
       about the same bar reads as a contradiction. */
    biggestAllInside:
      "The largest deviation is {bin}, at {percent}%. All {bins} data points fall within ±2σ.",
    biggestSomeOutside:
      "The largest deviation is {bin}, at {percent}%. {n} of {bins} data points {verb} outside " +
      "±2σ, where random variation alone would produce {expected}.",
    outsideFewer: "fewer than one",
    outsideAbout: "about {n}",
    /** Appended once the tally is stated, to say what it means. The band is
        built on the null hypothesis, so it is right to name the null. */
    withinNormal: "This is within the range expected if there is no effect.",
    outsideGrey:
      "Across all groups the spread is larger than random variation usually produces " +
      "(χ² = {chi} on {df} degrees of freedom, against a 5% threshold of {critical}). That " +
      "warrants a second look, but is not evidence of a cause on its own.",

    /* Verdict lines shared by the scatter panels. */
    verdictMaybe: "Maybe, but only just.",
    scatterStrength:
      "The correlation coefficient over {years} years is {r}. With this many years, |r| must " +
      "exceed {critical} to be statistically significant at the 5% level.",
    scatterNull: "Years with more {driver} have no more earthquakes than years with less.",
    scatterHint: "Treat this as suggestive rather than established.",

    weekdayQuestion: "Do earthquakes prefer a day of the week?",
    weekdayExplain: "",
    weekdaySubtitle: "Day of the week · {since}",

    monthQuestion: "Do earthquakes have a season? Is there such a thing as earthquake weather?",
    monthExplain:
      "Months are counted per day, because February is short. Grouping into twelve can make a " +
      "wobble look like a pattern, so we checked day by day as well — 365 separate bars — and " +
      "got the same answer." +
      "\n\nWeather follows the seasons, " +
      "and the seasons show nothing. Why is that? Earthquakes typically start ten kilometers or more underground. A big " +
      "storm presses on the ground about as hard as the moon does, and the moon, in the next " +
      "panel, does nothing." +
      "\n\nThere are a few locations where there are slight differences between earthquake rates between " +
      "summer and winter, but they are rare and associated with large swings, like the South Asian monsoon.",
    monthSubtitle: "Month of the year · {since}",

    moonQuestion: "Does the moon set off earthquakes?",
    moonVerdict: "No.",
    moonExplain:
      "This chart tests the question as it is usually asked: does the count depend on the phase " +
      "of the moon? If it did, the simplest expectation is two peaks, at new and full moon, when " +
      "the sun and moon pull together. There are none." +
      "\n\nThat is not the same as testing tidal stress. The stress a tide places on a fault " +
      "depends on the fault's orientation and depth, on ocean loading as well as the solid-earth " +
      "tide, and on whether earthquakes respond to peak stress or to how fast stress is " +
      "changing. Those calculations are done fault by fault, and averaging over every " +
      "orientation on Earth, as this chart does, would dilute a real effect. Careful studies do " +
      "find a small effect on a small number of very sensitive faults, mostly in regions with " +
      "high subsurface fluid pressures." +
      "\n\nWe tested the published claims of tidal precursors directly, and they did not hold up.",
    moonSubtitle: "Day of the lunar cycle · {since}",
    moonLink: "But can the moon predict earthquakes? We looked at 79 of the biggest",
    moonNewMoon: "new moon",
    moonFullMoon: "full moon",

    climateQuestion: "Is climate change causing earthquakes?",
    climateExplain:
      "When ice melts or groundwater drains away, the weight pressing on the crust changes, " +
      "and in a few places that has been tied to small earthquakes. But it is slow and local, " +
      "and it does not show up in the global total.",
    climateDriver: "warming",
    climateAxis: "Global temperature (°C above 1951–1980)",

    solarQuestion: "Does solar activity trigger earthquakes?",
    solarExplain:
      "The sun runs on a clear 11-year cycle, which makes it a tempting thing to line " +
      "earthquakes up against. They do not line up.",
    solarDriver: "solar activity",
    solarAxis: "Sunspot number",

    scatterSubtitle: "Each dot is one year, {from} onward",
    scatterYAxis: "{threshold} earthquakes",

    oklahomaQuestion: "Can people cause earthquakes?",
    oklahomaVerdict: "Yes, in some specific locations.",
    oklahomaExplain:
      "Oklahoma used to get about {rate} earthquakes of magnitude 3 or more a year. In " +
      "{peakYear} it got {peak}. The cause was wastewater from oil and gas drilling, pumped back " +
      "down into the ground. That raised the pressure on faults that were already close to " +
      "slipping. When the state limited the pumping, the earthquakes died away again." +
      "\n\nAttribution rarely rests on a single earthquake. An induced magnitude 4 is " +
      "indistinguishable from a natural one in the seismic record. But the pattern is " +
      "indisputable: the rate rose roughly a hundredfold, with events clustering within a few " +
      "kilometers of active injection wells. They followed injection volumes. And then, they " +
      "declined after the state restricted injection in 2015 and 2016.",
    oklahomaSubtitle: "Earthquakes of magnitude 3 or more in Oklahoma, each year",
    oklahomaAxis: "Earthquakes per year",
    oklahomaLegendBars: "Earthquakes that year",
    oklahomaLegendRate: "Normal rate before 2009 — about {rate} a year",

    method:
      "Aftershocks are left out of every panel here, on purpose. Aftershock sequences are " +
      "strongly clustered in time and space; including them would violate the independence the " +
      "error bands assume." +
      "\n\nThe first three panels use {count} earthquakes of magnitude {binMagnitude} and up " +
      "since {from}. The last two compare whole years, so they use magnitude {yearMagnitude} " +
      "and up, where the counts can be trusted from one decade to the next.",
    sources: "Data: {list}.",
    errorLoad: "Could not load the data.",
  },
} as const;
