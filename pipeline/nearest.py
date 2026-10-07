"""Nearest-neighbour declustering (Zaliapin & Ben-Zion), for the M6+ catalog.

Every earthquake is linked to the earlier earthquake "nearest" to it in a
space-time-magnitude metric,

    eta = t * r**DF * 10**(-B * m_parent)

with t in years, r the hypocentral distance in km and m the parent's
magnitude. Across a whole catalog, log10(eta) falls into two populations: a
background one (independent events, a Poisson-like scatter in space and time)
and a clustered one (aftershocks, sitting close to a big parent). The
threshold between them is fitted to this catalog with a two-component
Gaussian mixture rather than chosen by hand, which is the method's main
advantage over fixed Gardner-Knopoff windows.

Why this replaced the windows for M6+. Gardner-Knopoff's time windows come from
southern California and run 2.5-3 years at M6.5+; widened to global
distances, they removed 35% of M6+ events, half of them more than 100 days
after their "mainshock" and a third more than a year after -- including deep
events pinned to shallow ones over 1,000 km away (the 2012 M7.7 Sea of Okhotsk
event, 583 km deep, as a Tohoku aftershock). Nearest-neighbour removes 21%,
9% of them more than 100 days on, and the yearly mainshock counts come out
closer to Poisson (variance/mean 1.18 against 1.28), so what it leaves in
behaves like background rather than like clustering it missed.

Three choices worth knowing:

**Hypocentral distance.** Epicentral distance links a 600 km deep event to a
shallow one overhead. Depth is in the catalog; using it costs nothing.

**M6+ only.** The catalog is complete and on one magnitude scale above M6
from 1976. Run on smaller events, the clustered population would grow as
networks improved, and the declustering would change character over the
record -- exactly the drift the site exists not to mistake for seismicity.

**Forward-only, as the windows were.** An event is dependent only if it links
to an earlier one *and* the chain of links behind it contains an event at
least as large. Nothing is ever removed because of something that happened
later, so the current year is classified exactly as every past year was when
it was current. The usual rule -- the largest event in a cluster is the
mainshock, and everything before it a foreshock -- reclassifies foreshocks
once their mainshock arrives, which biases the end of the catalog. The price
is the same as before: a foreshock smaller than its mainshock survives, so
such a sequence counts twice.
"""

from __future__ import annotations

import math

DF = 1.6              # fractal dimension of epicentres (Zaliapin & Ben-Zion)
B = 1.0               # Gutenberg-Richter b-value
MIN_MAGNITUDE = 6.0   # see the module docstring: complete and homogeneous from here
EARTH_RADIUS_KM = 6371.0
YEAR_MS = 365.25 * 86_400_000
MIN_DISTANCE_KM = 1.0  # locations are not better than this; keeps r**DF finite


def nearest_neighbours(times: list[int], lats: list[float], lons: list[float],
                       depths: list[float], mags: list[float]) -> tuple[list[float], list[int]]:
    """Each event's eta to its nearest earlier neighbour, and that neighbour's index.

    `times` (epoch ms) must be ascending. The first event, and any with no
    earlier one, gets eta = inf and parent -1.
    """
    n = len(times)
    years = [t / YEAR_MS for t in times]
    rlat = [math.radians(v) for v in lats]
    rlon = [math.radians(v) for v in lons]
    coslat = [math.cos(v) for v in rlat]
    weight = [10 ** (-B * m) for m in mags]
    eta = [math.inf] * n
    parent = [-1] * n
    for j in range(1, n):
        best, best_i = math.inf, -1
        tj, laj, loj, cj, zj = years[j], rlat[j], rlon[j], coslat[j], depths[j]
        for i in range(j):
            dt = tj - years[i]
            if dt <= 0:
                continue
            a = (math.sin((laj - rlat[i]) / 2) ** 2
                 + cj * coslat[i] * math.sin((loj - rlon[i]) / 2) ** 2)
            r = 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))
            r = max(MIN_DISTANCE_KM, math.hypot(r, zj - depths[i]))
            e = dt * r ** DF * weight[i]
            if e < best:
                best, best_i = e, i
        eta[j], parent[j] = best, best_i
    return eta, parent


def fit_threshold(eta: list[float]) -> float:
    """log10(eta) where the clustered and background populations are equally likely.

    A two-component Gaussian mixture fitted by EM to log10(eta), stdlib only.
    """
    x = sorted(math.log10(e) for e in eta if math.isfinite(e) and e > 0)
    w, m1, m2 = 0.5, x[len(x) // 4], x[3 * len(x) // 4]
    s1 = s2 = 1.0

    def g(v: float, m: float, s: float) -> float:
        return math.exp(-0.5 * ((v - m) / s) ** 2) / (s * math.sqrt(2 * math.pi))

    for _ in range(300):
        r = []
        for v in x:
            a, b = w * g(v, m1, s1), (1 - w) * g(v, m2, s2)
            r.append(a / (a + b) if a + b > 0 else 0.5)
        total = sum(r)
        w = total / len(x)
        m1 = sum(ri * v for ri, v in zip(r, x)) / total
        m2 = sum((1 - ri) * v for ri, v in zip(r, x)) / (len(x) - total)
        s1 = math.sqrt(sum(ri * (v - m1) ** 2 for ri, v in zip(r, x)) / total)
        s2 = math.sqrt(sum((1 - ri) * (v - m2) ** 2 for ri, v in zip(r, x)) / (len(x) - total))
    if m1 > m2:
        w, m1, m2, s1, s2 = 1 - w, m2, m1, s2, s1

    # Walk up from the clustered mode to where the background takes over.
    v = m1
    while v < m2:
        if w * g(v, m1, s1) <= (1 - w) * g(v, m2, s2):
            return v
        v += 0.001
    return (m1 + m2) / 2


def classify(eta: list[float], parent: list[int], mags: list[float],
             log_threshold: float) -> list[bool]:
    """Per-event flag, True for a mainshock, under the forward-only rule."""
    n = len(eta)
    chain_max = [0.0] * n      # largest magnitude among an event's linked ancestors
    mainshock = [True] * n
    for j in range(n):
        p = parent[j]
        if p < 0 or not (eta[j] > 0 and math.log10(eta[j]) < log_threshold):
            continue
        chain_max[j] = max(mags[p], chain_max[p])
        mainshock[j] = chain_max[j] < mags[j]
    return mainshock
