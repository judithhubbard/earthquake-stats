// copy.home keys
    trendIntro:
      "We fit a straight line through the yearly counts for four different series — {threshold} " +
      "and {major}, each with aftershocks left in and taken out — and ask: can we see a " +
      "statistically meaningful change?" +
      "\n\nIt is tempting to pick and choose \u2014 find the correlation that works, discard " +
      "the rest. That is a common statistical trap known as p-hacking: choosing the test after " +
      "you look at the results. Here, we first calculate the p-value for each test, which tells " +
      "us how unusual that specific correlation is. Then, we calculate the combined probability " +
      "for all four tests, correcting for the fact that we asked the question in four different " +
      "ways — and for the fact that the four overlap. This last number is the one you should " +
      "look at.",

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

    trendColCombined: "Combined p-value for the four tests",

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

// copy.home.tech paragraphs
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
