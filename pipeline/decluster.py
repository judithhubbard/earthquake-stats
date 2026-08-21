"""Flag dependent events (aftershocks and foreshocks) in the local mirror.

    python3 pipeline/decluster.py

Window-based declustering in the Gardner & Knopoff (1974) style: events are
visited largest-first, and each unclaimed event claims every smaller event
inside its space-time window.

**The distance window is not stock GK, and this is a methodological choice worth
owning.** GK's distance scaling was calibrated on southern California and is far
too tight for global subduction zones -- it allows a M9 only ~125 km, when the
aftershock zone runs past 1000 km. Measured on this catalog, stock GK leaves the
M5+ annual-count Fano factor at 11.8 (Poisson = 1), i.e. it barely declusters the
great sequences at all.

So the distance window here is the larger of the GK radius and twice the Wells &
Coppersmith (1994) subsurface rupture length, which keeps GK's sensible behaviour
at small magnitudes and gives realistic aftershock zones at large ones:

    M5 -> 40 km    M6 -> 53 km    M7 -> 87 km    M8 -> 332 km    M9 -> 1262 km

Below about M6.8 the Gardner-Knopoff radius is the larger of the two and wins
the max(), so the widening only takes effect at the magnitudes it was meant
for. These figures are what space_window() returns; the table above them used
to predate the 2.0 factor, and the site quoted it.

This is a pragmatic hybrid, not a literature-standard scheme. Nearest-neighbour
declustering (Zaliapin & Ben-Zion) is the more defensible choice and does not
need a hand-tuned window; it is the intended replacement. Swap `space_window`
below to change the behaviour -- nothing else depends on the window shape.
"""

from __future__ import annotations

import argparse
import bisect
import math
import sys
import time as timer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "catalog.sqlite"

DAY_MS = 86_400_000
EARTH_RADIUS_KM = 6371.0


def space_window(mag: float) -> float:
    """Aftershock-zone radius in km."""
    gardner_knopoff = 10 ** (0.1238 * mag + 0.983)
    rupture_length = 10 ** (0.58 * mag - 2.42)  # Wells & Coppersmith subsurface RLD
    return max(gardner_knopoff, 2.0 * rupture_length)


def time_window_days(mag: float) -> float:
    """Gardner & Knopoff time window, unmodified."""
    if mag >= 6.5:
        return 10 ** (0.032 * mag + 2.7389)
    return 10 ** (0.5409 * mag - 0.547)


def decluster(times: list[int], lats: list[float], lons: list[float],
              mags: list[float]) -> list[bool]:
    """Return a per-event flag: True if the event is a mainshock.

    `times` must be ascending.

    **Windows run forward in time only.** A symmetric window looks like the more
    thorough choice -- it removes foreshocks too -- but it biases the end of the
    catalogue: a mainshock in the current year has only its earlier neighbours
    available to claim it, while a mid-catalogue event can be claimed from both
    sides. Recent years then come out under-declustered, and the current year
    lands at an artificially high percentile. Measured on this catalogue the
    symmetric version put 2026 M5+ mainshocks above *all* 36 reference years.

    Forward-only removes the bias entirely, because an event's classification
    depends solely on events that precede it, which are present for every year.
    Foreshocks survive, but they are a small population next to aftershocks, and
    GK's windows are aftershock windows to begin with.
    """
    n = len(times)
    mainshock = [True] * n
    if n == 0:
        return mainshock

    # Largest first: a claimed event never claims anything itself.
    order = sorted(range(n), key=lambda i: -mags[i])
    rad = [math.radians(v) for v in lats]
    cos_lat = [math.cos(r) for r in rad]

    for i in order:
        if not mainshock[i]:
            continue
        mag_i = mags[i]
        radius = space_window(mag_i)
        span = int(time_window_days(mag_i) * DAY_MS)

        lo = bisect.bisect_left(times, times[i])
        hi = bisect.bisect_right(times, times[i] + span)

        # Cheap bounding box first; the haversine is only paid on survivors.
        dlat = radius / 111.195
        lat_i, lon_i, rad_i, cos_i = lats[i], lons[i], rad[i], cos_lat[i]
        max_dlon = 180.0 if cos_i < 1e-6 else min(180.0, dlat / max(cos_i, 1e-6))

        for j in range(lo, hi):
            if j == i or not mainshock[j] or mags[j] > mag_i:
                continue
            if abs(lats[j] - lat_i) > dlat:
                continue
            dlon = abs(lons[j] - lon_i)
            if dlon > 180.0:
                dlon = 360.0 - dlon
            if dlon > max_dlon:
                continue
            sin_dlat = math.sin((rad[j] - rad_i) * 0.5)
            sin_dlon = math.sin(math.radians(dlon) * 0.5)
            a = sin_dlat * sin_dlat + cos_i * cos_lat[j] * sin_dlon * sin_dlon
            if 2.0 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a))) <= radius:
                mainshock[j] = False

    return mainshock


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default=str(DB_PATH))
    args = ap.parse_args()

    conn = store.connect(args.db)
    # Declustering uses the same homogenised magnitude the site reports, so
    # window sizes and the mainshock ordering match what the reader sees.
    rows = conn.execute(
        "SELECT id, time, lat, lon, COALESCE(mw, mag) AS mag FROM events "
        "WHERE evtype = 'earthquake' ORDER BY time ASC"
    ).fetchall()
    if not rows:
        print("Catalog is empty -- run `python3 pipeline/fetch.py --backfill` first.")
        return 1

    print(f"Declustering {len(rows):,} events…", flush=True)
    started = timer.monotonic()
    flags = decluster(
        [r["time"] for r in rows], [r["lat"] for r in rows],
        [r["lon"] for r in rows], [r["mag"] for r in rows],
    )
    elapsed = timer.monotonic() - started

    conn.executemany(
        "UPDATE events SET mainshock = ? WHERE id = ?",
        [(1 if flag else 0, row["id"]) for row, flag in zip(rows, flags)],
    )
    store.set_meta(conn, "declustered_at", str(int(timer.time())))
    conn.commit()

    kept = sum(flags)
    print(f"  {kept:,} mainshocks / {len(rows):,} events ({100 * kept / len(rows):.0f}% kept) "
          f"in {elapsed:.0f}s")
    for threshold in (5.0, 6.0, 7.0, 8.0):
        total = conn.execute(
            "SELECT COUNT(*) AS n FROM events WHERE COALESCE(mw, mag) >= ? "
            "AND evtype = 'earthquake'", (threshold,)).fetchone()["n"]
        main_n = conn.execute(
            "SELECT COUNT(*) AS n FROM events WHERE COALESCE(mw, mag) >= ? "
            "AND evtype = 'earthquake' AND mainshock = 1", (threshold,)).fetchone()["n"]
        print(f"  M{threshold:<4g} {main_n:>7,} / {total:>7,} kept ({100 * main_n / total:.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
