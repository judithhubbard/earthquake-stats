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
      "Each faint line is a past year. The shaded band covers the middle 90% of {years} of " +
      "them, so a line inside the band is an ordinary year.",
    noteMoment:
      "Moment measures how much the ground moved, not how often. One great earthquake can " +
      "outweigh a whole ordinary year, so this line can jump in a single afternoon.",
    noteMainshocks:
      "Aftershocks have been removed, so each earthquake sequence counts once. Deciding which " +
      "events belong to a sequence is a judgement call, and different choices give different counts.",
    noteLiveUnclassified:
      "{n} event{s} from the last day {is} too recent to have been sorted, and counted as separate.",

    /* The small print under the annual chart. */
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
    legendBand: "Middle 90% of {from}–{to}",
    yearsNone: "None",
    yearsSome: "{n} years",
    yearsCount: "{n} of {max}",

    /* Footer and failures. */
    generated: "Catalogue snapshot built {when}; live events appended from the USGS one-day feed.",
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
      "<strong>How to read these.</strong> Flip a coin ten times and you rarely get exactly " +
      "five heads. Earthquakes are the same. Even when nothing is going on, some months turn " +
      "out busier than others. The grey band shows how much of that variation to expect. A bar inside " +
      "the grey means that earthquakes are behaving randomly. A bar that sticks out might be worth a look.",

    legendBand: "Range expected from chance alone",
    legendAbove: "More earthquakes than average",
    legendBelow: "Fewer than average",
    subtitleSince: "Magnitude {threshold} and up, since {from}",

    /* Verdict lines shared by the bar panels. */
    verdictNo: "No.",
    verdictNotReally: "Not really.",
    biggestGap: "{bin} is furthest from average, by {percent}%.",
    insideGrey: "That is inside the grey, so it is just luck.",
    outsideGrey:
      "The bars show a little more variation than a random process would usually give. Worth a second look, but it " +
      "proves nothing by itself.",

    /* Verdict lines shared by the scatter panels. */
    verdictMaybe: "Maybe, but only just.",
    scatterStrength:
      "If there were a link, the dots would trend in one direction or the other. Over {years} years they score {r}, and " +
      "anything under {critical} counts as no link.",
    scatterNull: "Years with more {driver} get no more earthquakes than quiet ones.",
    scatterHint: "With this few years, treat it as a hint, not an answer.",

    weekdayQuestion: "Do earthquakes prefer a day of the week?",
    weekdayExplain:
      "Start here. A fault cannot know it is Tuesday, so this panel shows what nothing looks " +
      "like. Every other panel is judged against it.",
    weekdaySubtitle: "Day of the week · {since}",

    monthQuestion: "Do earthquakes have a season? Is there such a thing as earthquake weather?",
    monthExplain:
      "Months are counted per day, because February is short." +
      "\n\nWeather follows the seasons, " +
      "and the seasons show nothing. Why is that? Earthquakes typically start ten kilometres or more underground. A big " +
      "storm presses on the ground about as hard as the moon does, and the moon, in the next " +
      "panel, does nothing." +
      "\n\nThere are a few locations where there are slight differences between earthquake rates between " +
      "summer and winter, but they are rare and associated with large swings, like the South Asian monsoon.",
    monthSubtitle: "Month of the year · {since}",

    moonQuestion: "Does the moon set off earthquakes?",
    moonVerdict: "No.",
    moonExplain:
      "If the moon set off earthquakes you would see two humps here — one at new moon and one " +
      "at full, when the sun and moon line up and pull together hardest. There are no humps. " +
      "Every bar sits inside the grey." +
      "\n\nThat does not prove the moon does nothing at all. Careful studies find a small " +
      "effect on a small number of faults, mostly where ocean tides press on the seafloor. " +
      "This chart is not sensitive enough to see something that small — and neither is anything " +
      "else you could use to plan your day.",
    moonSubtitle: "Day of the lunar cycle · {since}",
    moonLink: "But can the moon predict earthquakes? We looked at 79 of the biggest",
    moonNewMoon: "new moon",
    moonFullMoon: "full moon",

    climateQuestion: "Is climate change causing earthquakes?",
    climateExplain:
      "When ice melts or groundwater drains away, the weight pressing on the crust changes, " +
      "and in a few places that has been tied to small earthquakes. But it is slow and local, " +
      "and it never shows up in the world total.",
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
    oklahomaVerdict: "Yes — and this is what a real effect looks like.",
    oklahomaExplain:
      "Oklahoma used to get about {rate} earthquakes of magnitude 3 or more a year. In {peakYear} " +
      "it got {peak}. The cause was wastewater from oil and gas drilling, pumped back down into " +
      "the ground. That raised the pressure on faults that were already close to slipping. When " +
      "the state limited the pumping, the earthquakes died away again." +
      "\n\nCan you tell whether one particular earthquake was our doing? Usually not from the " +
      "earthquake itself — a man-made magnitude 4 shakes the ground just like a natural one. You " +
      "tell from the pattern. A quiet place suddenly gets hundreds. They sit right next to the " +
      "wells. They start when the pumping starts, and fade when it stops. Any one of them could " +
      "be a coincidence. All of them together cannot be." +
      "\n\nNow look back at the panels above. Same method, same data. Here it finds something " +
      "enormous. There it finds nothing.",
    oklahomaSubtitle: "Earthquakes of magnitude 3 or more in Oklahoma, each year",
    oklahomaAxis: "Earthquakes per year",
    oklahomaLegendBars: "Earthquakes that year",
    oklahomaLegendRate: "Normal rate before 2009 — about {rate} a year",

    method:
      "Aftershocks are left out of every panel here, on purpose. An earthquake predicts other " +
      "earthquakes better than anything else we know of: leave the aftershocks in and one big " +
      "rupture and its hundreds of followers would swamp every chart on the page. Stripping " +
      "them out is what makes it possible to look for anything smaller." +
      "\n\nThe first three panels use {count} earthquakes of magnitude {binMagnitude} and up " +
      "since {from}. The last two compare whole years, so they use magnitude {yearMagnitude} " +
      "and up, where the counts can be trusted from one decade to the next.",
    sources: "Data: {list}.",
    errorLoad: "Could not load the data.",
  },
} as const;
