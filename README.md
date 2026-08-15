# Are there more earthquakes than usual this year?

A single-question site: this year's cumulative count of **M6+ earthquakes
worldwide**, drawn against every year since 1976, live from the USGS catalog.

The question is deliberately about *this year*, not about long-run trends. A
decadal trend cannot change between visits and cannot be checked by eye against
the chart under it; "more than usual this year" genuinely flips, and the hero
chart is the evidence for whichever way it lands.

## Two thresholds, one region, one window

M6+ or M7+ globally, 1976 onward. Region and reference-period selectors existed
and were removed: each let a reader wander into a part of the catalogue where
completeness changes over time, and each needed its own caveat.

Magnitude is offered, but only M6 and M7 — both are complete and comparable
across decades, and nothing below M6 is on the menu. Every selectable threshold
needs its own emitted tier (`TIERS` in `pipeline/build.py`), because magnitudes
are quantised to 0.1 in the binary and filtering a coarse tier down to a finer
threshold would misclassify events at the boundary.

Controls: **Magnitude**, **Measure** (count or moment), **Catalogue** (all
earthquakes or mainshocks only), and **Years** to highlight.

At M7+ the annual chart drops its M7+ share split, since that would be the whole
bar.

## Architecture

There is no query backend, and there shouldn't be one. M6+ since 1970 is 7,993
events, which packs to 86 KB — so the catalog ships to the browser and every
filter runs client-side, instantly.

Three tiers:

1. **Baseline (static).** `pipeline/fetch.py` mirrors ComCat into SQLite,
   `pipeline/decluster.py` flags dependent events, and `pipeline/build.py` emits
   the packed binary. A cron job refreshes them.
2. **Live (client-direct).** The page polls USGS's `all_day.geojson` itself every
   60s. That feed is CORS-enabled and CDN-cached at 60s, so the browser can hit
   it directly — no proxy, and our traffic never touches the FDSN query service.
   It carries event ids and place names, so new events reach the event list too,
   not just the counts.
3. **Event pages.** Not built yet.

The SQLite mirror still holds the full M4.5+ catalog (295k events) because
declustering needs it. Only M6+ is emitted to the client.

| file | contents | size |
|---|---|---|
| `m6.bin` | 7,993 events, packed | 86 KB |
| `m7.bin` | 785 events, packed | 8 KB |
| `m6.detail.json` | ids + place names for the event list | 362 KB (lazy) |
| `land-110m` chunk | coastlines | 21 KB gzipped (lazy) |

## Running it

```bash
python3 pipeline/fetch.py --backfill   # ~10 min, once
python3 pipeline/magnitudes.py         # ~25 min, once — see "Homogenising magnitudes"
python3 pipeline/decluster.py          # ~40 s over the full catalogue
python3 pipeline/build.py
python3 pipeline/context.py            # temperature, sunspots, Oklahoma
cd web && npm install && npm run dev
```

Incremental refresh (safe to cron):

```bash
python3 pipeline/fetch.py
python3 pipeline/magnitudes.py --start $(( $(date -u +%Y) - 1 ))
python3 pipeline/decluster.py
python3 pipeline/build.py
python3 pipeline/context.py
```

Moment tensors arrive within days to weeks of an event, so recent years keep
changing while older ones are settled — the cron only re-harvests the last two.

The pipeline is stdlib-only — no pip install.

## Page order

Headline → controls → cumulative chart → annual chart → map and event list.
That order is the argument, not a layout accident. The cumulative chart is both
the novel content and the actual answer to the question in the title. The map is
the least novel thing on the page and reads as detail, so it sits at the bottom.

## Homogenising magnitudes to Mw

`pipeline/magnitudes.py` exists because the early catalogue looks like it is
missing events and is not.

ComCat's *preferred* magnitude for a large earthquake changed character over the
catalogue's life:

| period | mb | Ms | Mw-family |
|---|---:|---:|---:|
| 1970–75 | 13% | 28% | 60% |
| **1976–83** | **23%** | **58%** | **19%** |
| 1984–89 | 1% | 3% | 96% |
| 1996–2025 | 2% | 0% | 97% |

Ms and mb run low against Mw for these events, and mb saturates above ~6.5, so
fewer early events clear a fixed M6.0 bar. The deficit is roughly *constant
across magnitude* — rates relative to a 1996–2025 baseline sat at 0.65 / 0.69 /
0.71 / 0.72 / 0.60 for thresholds 6.0 through 7.2 — which is the signature of a
systematic magnitude offset (≈0.19 units, b≈1), not of a detection threshold. A
completeness problem would climb toward 1.0 by M7 and this does not.

The fix is that **ComCat already holds the Mw**; it just does not prefer it.
The 1977 Philippines event `usp0000myv` is preferred Ms 7.0 and also carries
Mw 7.23 (ISC-GEM) and Mwc 7.2 (GCMT). Those values are reachable only through
`format=quakeml&includeallmagnitudes=true` — CSV and GeoJSON carry the preferred
magnitude alone.

So the pipeline harvests every contributed magnitude for M5.5+ events and
prefers Mw where one exists (`mww` > `mwc` > `mwb` > `mwr` > `mw`), storing it in
`events.mw` alongside the untouched preferred magnitude in `events.mag`. Every
downstream query uses `COALESCE(mw, mag)`, including the tier threshold — so an
event preferred as Ms 5.9 with a GCMT Mw of 6.1 is now correctly counted, which
is why the harvest reaches below the reporting threshold.

It closes the gap from both directions, which is what distinguishes a fix from a
thumb on the scale — the early years rise and the middle years are trimmed:

| period | M6+/yr before | after |
|---|---:|---:|
| 1976–83 | 96.4 | **129.6** |
| 1984–89 | 142.7 | 131.5 |
| 1990–99 | 153.0 | 142.1 |
| 2010–19 | 149.3 | 150.3 |

Coverage is 99–100% of M6+ events in every period (25,778 of 26,770 M5.5+
events overall). The M6+ tier grows from 7,844 events to 7,993.

One trap worth knowing if you touch this code: ComCat's QuakeML gives
`catalog:eventid` *without* the network prefix — `p0000sa7` where the ComCat id
is `usp0000sa7`, with the prefix in `catalog:eventsource`. Using the bare
attribute matches no rows, and an UPDATE that matches nothing is silent. The
harvester reports rows actually changed for that reason.

The harvest is ~145 MB of QuakeML across ~56 yearly requests, so it belongs in
the backfill; the cron re-runs only the last two years, since moment tensors
arrive within days to weeks and older years are settled.

## Why the reference window can start at 1976

Before homogenisation it could not. M6+ counts were not stationary across the
window — fitted over 1976–1995 they rose 37.5%/decade (t = 6.5) and then
flattened — and starting there would have made the annual chart display a
significant upward trend that was catalogue history, not seismicity.

Preferring Mw removes it. The same fits, after:

| period | mean/yr | trend | t |
|---|---:|---:|---:|
| 1976–1995 | 135.9 | +9.8%/decade | 1.92 |
| 1996–2025 | 145.5 | −1.7%/decade | −0.48 |
| 1976–2025 | 141.7 | +2.2%/decade | 1.38 |

Nothing is significant, and the decade means flatten from 109/126/153/158/149/133
to **134/130/142/153/150/133**. The variance-to-mean ratio over 1976–2025 drops
from 5.99 to 3.63 — a good part of what looked like clustering was the scale
change inflating the spread.

The strongest check is that the choice of start year stopped mattering. This
year lands at the 66th percentile against 1976, the 64th against 1990 and the
67th against 1996; before homogenisation those were 62nd, 53rd and 60th. When
the window no longer moves the answer, the window is no longer doing any work.

Residual: 1976–1995 still fits at +9.8%/decade (t = 1.92). Not significant, but
not zero either — roughly 1% of events have no Mw at all, and the earliest years
are the likeliest place for genuine incompleteness to remain. No trend line is
drawn on the annual chart, so the site never asserts it either way.

## Counting versus moment

The measure toggle switches the whole page between counting earthquakes and
summing scalar seismic moment (Hanks & Kanamori, in units of 10²⁰ N·m so the
axes carry human-sized numbers). Every downstream statistic — band, percentile,
annual chart — works unchanged, because only what accumulates into the daily
bucket changes.

Moment is summed over **M6+ only**, like everything else here. That captures
about 96% of global moment (91.9% in 1976–85, 97.7% in 2000–09 — the share
tracks whether a great earthquake happened). Including M4.5–6 would recover the
rest but reintroduce exactly the completeness problem the single threshold
exists to avoid.

Moment switches off the **catalogue** control, because aftershocks release real
energy and removing them would undercount a physical quantity — where for counts
it is the whole point. Switching a control off is not enough on its own: a greyed
control still highlighting "Mainshocks only" would claim moment was declustered,
so the highlight moves to "All earthquakes" and back again.

The variance-to-mean ratio is suppressed in moment mode: it is a counting
statistic and is not dimensionless on moment.

## Declustering

`pipeline/decluster.py` flags dependent events. Two decisions are load-bearing:

**Distance windows are not stock Gardner–Knopoff.** GK's scaling was calibrated
on southern California and allows a M9 only ~125 km, when the aftershock zone
runs past 1000 km. The window here is the larger of the GK radius and twice the
Wells & Coppersmith rupture length. This is a pragmatic scheme, not a
literature-standard one; nearest-neighbour (Zaliapin & Ben-Zion) is the intended
replacement.

**Windows run forward in time only.** A symmetric window also removes foreshocks,
but it biases the end of the catalogue — a current-year event can only be claimed
by earlier neighbours, while a mid-catalogue event can be claimed from both
sides. The symmetric version put 2026 M5+ mainshocks at the **100th percentile**
of all reference years, i.e. it manufactured exactly the "earthquakes are
increasing" conclusion the site exists to test.

Variance-to-mean ratio of annual counts, global (1.0 = no clustering):

| | all events | mainshocks only |
|---|---:|---:|
| M6+ | 3.55 | 1.57 |

## The map

Equal Earth, fixed. A projection selector existed and was removed — the question
the map answers is where the year's earthquakes were, and only an equal-area
projection lets a cluster of dots mean the same thing wherever it sits.

The clip band must contain the whole catalogue (M6+ reaches 85°N); a tighter band
silently drops dots the captions still count.

A region filter drawn as a lat/lon box was removed with the region selector. If
it returns, `map.ts` carries the warning in a comment: d3-geo reads a spherical
polygon's interior from its winding direction, and the intuitive winding made a
box cover **12.38 of the sphere's 12.57 steradians** — filling the world and
punching the region out as a hole. Reverse the ring, and subdivide its edges so
they follow parallels rather than great circles.

## Linking to Earthquake Insights

`web/public/data/posts.json` maps ComCat event ids to post URLs, and the event
panel shows a "Read our analysis" link for any event listed there. It is
hand-maintained and **not** written by the pipeline, so entries survive a
rebuild; it ships empty.

## Editing the text

**Almost every word the site says lives in `web/src/copy.ts`.** Change the text
between the quote marks and that is the whole job:

```ts
answerAverage: "<strong>No.</strong> {year} is running about average.",
```

Things in `{curly braces}` are filled in with live numbers when the page loads.
Keep them spelled as they are; you can move one around inside a sentence, use it
twice, or drop one you do not want. `<strong>…</strong>` makes text bold.

The one exception is the prose block on the front page — the headline, and the
"Then why does it feel like there are more?" section — which is plain HTML in
`web/index.html`, because it is a page of writing rather than labels wrapped
around numbers.

After editing: `cd web && npm run build`, or just commit and push, since the site
rebuilds on every push.

## Things that will bite you

**Revisions, not new events, are the hard part.** Magnitudes get revised for weeks
after an event. Incremental runs query `updatedafter`, not `starttime`; a time
cursor would silently freeze stale magnitudes for everything already ingested.

**ComCat carries non-earthquakes.** The mirror holds 562 nuclear explosions among
other things. `build.py` filters on `evtype = 'earthquake'`.

**Some place names are mangled upstream.** ComCat returns `47 km E of ?arai,
Japan` for Ōarai, in both its CSV and GeoJSON output. The pipeline is not
corrupting it. If it matters, the fix is a correction table in `build.py`.

**Magnitudes are quantised to 0.1 in the binary.** Every selectable threshold
must have its own emitted tier, and `CatalogStore.tierFor` throws rather than
approximating — six events sit between M6.95 and M7.0, and filtering a coarse
tier down to a finer threshold would count them as M7+ when ComCat does not.

**Magnitude scales drifted.** NEIC's preferred magnitude for large events shifted
wholesale to the W-phase solution around 2010: 46% of M6+ events carried a
generic Mw in the 1990s against 95% Mww since 2020. Offsets between those scales
run to a few hundredths of a unit, enough to move counts near a threshold by
roughly a tenth. This is a second reason no trend line is drawn.

**This is not a git repository.** Several deliberate removals (regions,
projections, magnitude tiers) deleted working, tested code with no way back.
`git init` before the next round of changes.

## The aftershocks page (disabled)

`/aftershocks.html` — "can earthquakes cause earthquakes?" — is built but **not
published**: it has no entry in `vite.config.ts` and nothing links to it, so it
is absent from `dist/` and 404s on the live site.

Everything needed to revive it is still here: `web/aftershocks.html`,
`web/src/aftershocks.ts`, the `aftershocks` block in `web/src/copy.ts`, and
`pipeline/sequences.py`. Add the entry back to `vite.config.ts` and re-add a
link to switch it on.

## The correlations page

`/correlations.html` answers the questions the front page invites: the moon, the
seasons, the weather, the sun, and whether people cause earthquakes. It is a
separate page with its own URL rather than a toggle on the front page, because
each question is a thing someone will want to link to.

**It is not headlined "do earthquakes correlate with anything?"** — that draft
title was simply false. Earthquakes correlate strongly with faults and with each
other; aftershock clustering is about the most reliable relationship in the
subject, and this page *removes* it before it starts looking. The page asks
whether anything **outside** the Earth sets them off, and the headline answer
leads with the true positive: *No. But they do follow each other.*

Every panel is the same shape — bars against a shaded band of what chance alone
produces — so a reader never has to judge whether 3% is a lot, only whether a bar
leaves the grey.

**Three decisions carry the statistics:**

*Mainshocks only, everywhere.* Aftershocks arrive in bursts and land in whichever
bin their mainshock fell in. Leaving them in would break the independence the
error bands assume and make every null look better than it is.

*M5+ for the within-year bins, M6+ for the year-over-year scatters.* Day of week,
month and moon phase compare bins drawn from the same span of years, so the
catalogue's changing completeness hits every bin equally and cancels — which
frees the page to use M5+ and buy real power (a 1.8% detectable effect against
6.2% at M6+). Temperature and sunspots compare whole years, where completeness
does not cancel, so those use the homogenised M6+ series.

*The moon panel does not claim a finding, on purpose.* A spring-tide/neap-tide
comparison gives +1.5% at M4.5+, +1.9% at M5+ and +1.5% at M6+ — consistent in
sign, but clearing significance at only one of the three. And that directional
test was chosen *after* an eight-bin test came out messy, which is post-hoc test
selection. Bradley & Hubbard's series on tidal triggering is precisely about how
that kind of selective analysis manufactures results, so committing it while
explaining it would be poor form. The panel reports the gap and says it is not
solid.

It then answers the question people actually mean. "Does the moon set off
earthquakes" is usually a question about *warning*, and there the answer is
clean: across 79 great thrust earthquakes, about 5% showed a tidal signal
beforehand — exactly the share random data gives. The panel links to the series.

Charts here plot **deviation from average, not raw counts**. Counts were
unreadable: every bar stood ~5,000 tall while the whole question lived in the
top 3%, so the error band was a hairline near the top and the bars looked
identical. Centring on zero puts the answer where the eye already is. Individual
bars are never highlighted either — with seven or twelve bins, one poking out of
a 2-sigma band is ordinary, and colouring it would imply a finding the
whole-chart test does not support.

Seasons and "earthquake weather" are separate claims and get separate answers.
The month chart covers seasons. Earthquake weather needs no chart: earthquakes
start ten kilometres down, where the weather cannot reach.

Oklahoma is the punchline: an average of 3 M3+ earthquakes a year until 2008,
930 in 2015, and a fall after wastewater injection was restricted.

## Still to build

Roughly in value order: rolling 365-day count (no Jan 1 artifact), day-of-week
and month control charts for the "patterns people think they see" section,
nearest-neighbour declustering, the Oklahoma induced-seismicity case study, and
event permalink pages with Substack links.
