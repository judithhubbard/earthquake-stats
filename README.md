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
2. **Live (client-direct).** The page polls USGS's `4.5_day.geojson` itself every
   60s. That feed is CORS-enabled and CDN-cached at 60s, so the browser can hit
   it directly — no proxy, and our traffic never touches the FDSN query service.
   M4.5+ rather than `all_day`: the page only ever offers M6+ and M7+, so the
   smaller feed is a strict superset of what it reads, at 20 KB against 225 KB.
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
cd web && npm install && npm run dev
```

Incremental refresh (safe to cron):

```bash
python3 pipeline/fetch.py
python3 pipeline/magnitudes.py --start $(( $(date -u +%Y) - 1 ))
python3 pipeline/decluster.py
python3 pipeline/build.py
```

Moment tensors arrive within days to weeks of an event, so recent years keep
changing while older ones are settled — the cron only re-harvests the last two.

The pipeline is stdlib-only — no pip install.

## Page order

The page lives at `/unusual/`. `web/index.html` is only a redirect to it, kept so
links to the old root URL, `?date=` included, still land.


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

Two methods, by magnitude.

**M6 and up: nearest neighbour** (`pipeline/nearest.py`, Zaliapin & Ben-Zion).
Each event is linked to the earlier event minimising
η = t · r^1.6 · 10^(−m_parent), with t in years and r the *hypocentral*
distance in km. log₁₀η is cleanly bimodal on this catalog (background mode near
−3.8, clustered near −6.9) and the threshold between them is fitted each run
by a two-component Gaussian mixture: −5.23 at the time of writing, carried in
`meta.json` as `nearest.log10Eta0`. It runs on M6+ alone, where the catalog is
complete and on one magnitude scale from 1976, so its reach cannot drift with
network growth. The result goes in its own column, `mainshock_nn`, which the
M6 and M7 tiers emit.

It replaced Gardner–Knopoff windows for M6+ in October 2026. Measured against
them on the same catalog:

| | GK windows | nearest neighbour |
|---|---:|---:|
| M6+ events removed | 35% | 21% |
| mainshocks per year | 92.3 | 111.8 |
| variance/mean of yearly mainshock counts | 1.28 | 1.18 |
| removals more than 100 days after their parent | 50% | 9% |
| removals more than a year after | 31% | 4% |

GK's time windows (2.5–3 years at M6.5+) with globally widened radii were
removing background as well as aftershocks — the 2012 M7.7 Sea of Okhotsk
event, 583 km deep, went as a Tohoku aftershock 1,297 km away. Shifting the
fitted threshold by ±0.5 moves the mainshock rate by 5–9 a year.

**Gardner–Knopoff windows** did the job for every magnitude until October 2026,
and below M6 for the correlations page's M5+ panels until that page was taken
down. Nothing reads them now, and they are in git history.

**It is forward-only.** An event is dependent only if it links to an
*earlier* event at least as large. A symmetric scheme also
removes foreshocks, but biases the end of the catalogue: a current-year event
can only be claimed by earlier neighbours, while a mid-catalogue event can be
claimed from both sides. The symmetric GK version put 2026 M5+ mainshocks at
the **100th percentile** of all reference years, i.e. it manufactured exactly
the "earthquakes are increasing" conclusion the site exists to test. For
nearest neighbour the forward-only rule replaces the usual "largest event in
the cluster is the mainshock", which reclassifies foreshocks once their
mainshock arrives. The cost, as with the windows: a foreshock smaller than its
mainshock survives, so that sequence counts twice.

Live events are classified in the browser with the same metric and threshold
(`web/src/decluster.ts`), matching the pipeline on 833 of 836 events in the
three days after every M7.5+ since 1990; the misses are the binary's 0.1
magnitude rounding at the threshold.

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

## The posts page

`/posts/` maps every Earthquake Insights post at the USGS earthquakes it links
to, with the whole archive as a searchable list under the map. It replaces
Kyle's hand-updated Leaflet map (kyleedwardbradley.github.io/earthquake_insights_map).

`pipeline/posts.py` builds it on every run, and its docstring has the detail:

- Titles, dates, cover images and paywall status come from Substack's public
  archive API, fresh each run.
- **Links come from the posts themselves, during their free month.** Substack
  only serves the full text of a free post, and new posts are free for 30
  days, so each run reads every post that is free now and records the USGS
  event pages it links to in `pipeline/posts.csv`. After the paywall the rows
  stay as last read.
- **It runs on a Mac, not in CI.** Substack's Cloudflare answers 403 to
  GitHub's servers for everything (API, feed, pages). `pipeline/read-posts.sh`
  works in its own clone under `~/Library/Application Support/earthquake-posts`,
  runs `posts.py`, and pushes `posts.csv` and `posts.json`; the push triggers
  the deploy. launchd runs it at 9:00 and 21:00 (missed runs happen on wake),
  and `~/Desktop/Update posts map.command` runs it by hand after publishing.
  Install or reinstall with `pipeline/read-posts.sh --install`; the log is
  `~/Library/Logs/earthquake-posts.log`. A post only has to be read once in its
  30 free days, so the Mac being off for a few days costs nothing.
- Events from the fortnight before a post are its **subject** and are drawn;
  older ones it cites are **context**, drawn as dashed rings only while the post
  is selected.
- The back catalogue was seeded from title matching (magnitude, date and a
  place name against ComCat; source `title`) and from the old map's hand-placed
  points (source `oldmap`). A Substack export, which has the full text of every
  post, should replace those with real links (source `export`).
- **To fix a post by hand**, replace its rows in `posts.csv` with rows whose
  source is `hand`: an event id (the rest is filled in from ComCat on the next
  run) or a lat/lon and a place label. Hand rows are never overwritten.

The page is not linked from `/unusual/` yet.

Plate boundaries (`web/public/data/plates.json`) are Bird (2003) PB2002 from
github.com/fraxen/tectonicplates (ODC-BY), rounded to 0.1°.

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
`web/unusual/index.html`, because it is a page of writing rather than labels wrapped
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

## The aftershocks page (removed)

`/aftershocks.html` — "can earthquakes cause earthquakes?" — was built but never
published: no entry in `vite.config.ts`, nothing linking to it, so it was absent
from `dist/` and 404'd on the live site, while `pipeline/sequences.py` was never
run by the workflow and its `sequences.json` sat frozen at whatever was last
committed. Half-alive, and drifting further every month.

It was deleted rather than left to rot. Everything is recoverable from git
history: `web/aftershocks.html`, `web/src/aftershocks.ts`, the `aftershocks`
block in `web/src/copy.ts`, `pipeline/sequences.py` and
`web/public/data/sequences.json`. Reviving it means restoring those, adding the
entry to `vite.config.ts`, linking to it, and putting the pipeline step in the
workflow behind a daily gate.

## The correlations page (removed)

`/correlations.html` asked whether the moon, the seasons, the weather or the
sun set earthquakes off. It was unlinked from the front page on 2026-10-07
(the link is in `web/attic/correlations-link`) and taken off the site the same
day, at the author's request, after the switch to nearest-neighbour
declustering moved its sunspot panel from p = 0.12 to p = 0.04 -- a result
that depends on how aftershocks are removed is not one to publish as a
finding.

It went whole: `web/correlations.html`, `web/src/correlations.ts`,
`web/src/correlate.ts` (its one function the front page needs,
`correlationP`, moved to `stats.ts`), the `correlations` block of
`web/src/copy.ts`, `flipTable` in `verdict.ts`, `pipeline/context.py` and its
`context.json`, the M5+ tier it alone read, and the workflow's context step.
All of it is in git history.

## Still to build

Roughly in value order: day-of-week and month control charts for the "patterns
people think they see" section, nearest-neighbour declustering, and event
permalink pages with Substack links.

Done since this list was written: the rolling 365-day count (the **Last 365
days** window, which removes the Jan 1 artifact) and the Oklahoma
induced-seismicity panel.
