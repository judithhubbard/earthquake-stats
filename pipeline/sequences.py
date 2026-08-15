"""Measure how earthquakes trigger each other, for the aftershocks page.

    python3 pipeline/sequences.py

Three things come out of this, all written to web/public/data/sequences.json:

  * **The stack.** Every M7+ mainshock is laid on top of every other, aligned on
    the moment it happened, and the M5+ earthquakes around each one are counted
    day by day. One sequence is anecdote; six hundred stacked is a law.
  * **The decay.** The same events in log-spaced bins after the mainshock, which
    is where Omori's 1/t shows up as a straight line.
  * **Two sequences by name**, one that announced itself and one that did not.

The work is O(events in window) per mainshock rather than O(n^2): the catalogue
is time-sorted, so each mainshock only scans its own slice.
"""

from __future__ import annotations

import argparse
import bisect
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "catalog.sqlite"
OUT = ROOT / "web" / "public" / "data" / "sequences.json"

DAY_MS = 86_400_000
EARTH_DIAMETER_KM = 12742.0

MIN_MAGNITUDE = 5.0          # what gets counted
ANCHOR_MAGNITUDE = 7.0       # what counts as a mainshock to stack on
RADIUS_KM = 300.0            # aftershock zone for an M7-ish rupture
STACK_DAYS = 30              # window either side, for the before/after chart
DECAY_DAYS = 100.0           # window after, for the Omori fit

# Foreshock counting: "followed by something larger, close by, soon after".
FORESHOCK_DAYS = 3.0
FORESHOCK_KM = 100.0

# Named sequences. One with a famous foreshock sequence, one with nothing at all.
EXAMPLES = [
    ("official20110311054624120_30", "with"),
    ("official20041226005853450_30", "without"),
]
EXAMPLE_RADIUS_KM = 150.0


def haversine(lat1, lon1, lat2, lon2) -> float:
    p = math.pi / 180
    dlat = (lat2 - lat1) * p
    dlon = (lon2 - lon1) * p
    a = (math.sin(dlat / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(dlon / 2) ** 2)
    return EARTH_DIAMETER_KM * math.asin(min(1.0, math.sqrt(a)))


def load(conn):
    rows = conn.execute(
        "SELECT id, time, lat, lon, COALESCE(mw, mag) AS mag, mainshock, place "
        "FROM events WHERE COALESCE(mw, mag) >= ? AND evtype = 'earthquake' "
        "ORDER BY time ASC", (MIN_MAGNITUDE,)).fetchall()
    return rows


def stack_and_decay(rows) -> tuple[list[dict], list[dict], dict, int]:
    times = [r["time"] for r in rows]
    anchors = [i for i, r in enumerate(rows)
               if r["mag"] >= ANCHOR_MAGNITUDE and r["mainshock"] == 1]

    daily = {d: 0 for d in range(-STACK_DAYS, STACK_DAYS + 1)}

    # Log-spaced bins: aftershock rates fall by orders of magnitude within hours,
    # so equal-width bins would put almost everything in the first one.
    edges = [10 ** x for x in
             [-2 + 4 * i / 24 for i in range(25)]]  # 0.01 to 100 days, 24 bins
    decay = [0] * (len(edges) - 1)

    span = STACK_DAYS * DAY_MS
    for i in anchors:
        lat, lon, t0 = rows[i]["lat"], rows[i]["lon"], times[i]
        lo = bisect.bisect_left(times, t0 - span)
        hi = bisect.bisect_right(times, t0 + int(DECAY_DAYS * DAY_MS))
        for j in range(lo, hi):
            if j == i:
                continue
            if haversine(lat, lon, rows[j]["lat"], rows[j]["lon"]) > RADIUS_KM:
                continue
            offset = (times[j] - t0) / DAY_MS
            day = math.floor(offset)
            if -STACK_DAYS <= day <= STACK_DAYS:
                daily[day] += 1
            if offset > 0:
                b = bisect.bisect_right(edges, offset) - 1
                if 0 <= b < len(decay):
                    decay[b] += 1

    k = len(anchors)
    stack = [{"day": d, "rate": daily[d] / k} for d in sorted(daily)]
    decay_rows = []
    for b in range(len(decay)):
        width = edges[b + 1] - edges[b]
        if decay[b] == 0:
            continue
        decay_rows.append({
            "days": math.sqrt(edges[b] * edges[b + 1]),   # geometric mid-point
            "rate": decay[b] / k / width,
            "count": decay[b],
        })

    # Omori exponent from a least-squares fit in log-log space.
    xs = [math.log10(r["days"]) for r in decay_rows]
    ys = [math.log10(r["rate"]) for r in decay_rows]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    slope = sxy / sxx
    fit = {"p": -slope, "intercept": my - slope * mx}
    return stack, decay_rows, fit, k


def foreshock_fractions(rows) -> dict:
    """Share of events that turn out, in hindsight, to have come before a bigger one."""
    times = [r["time"] for r in rows]
    window = int(FORESHOCK_DAYS * DAY_MS)
    counts = {"any": 0, "half": 0, "full": 0}

    for i, row in enumerate(rows):
        hi = bisect.bisect_right(times, times[i] + window)
        best = 0.0
        for j in range(i + 1, hi):
            if rows[j]["mag"] <= row["mag"]:
                continue
            if haversine(row["lat"], row["lon"], rows[j]["lat"], rows[j]["lon"]) > FORESHOCK_KM:
                continue
            best = max(best, rows[j]["mag"] - row["mag"])
        if best > 0:
            counts["any"] += 1
            if best >= 0.5:
                counts["half"] += 1
            if best >= 1.0:
                counts["full"] += 1

    n = len(rows)
    return {k: round(100 * v / n, 1) for k, v in counts.items()} | {"total": n}


def example_series(rows, event_id: str, kind: str) -> dict | None:
    times = [r["time"] for r in rows]
    index = next((i for i, r in enumerate(rows) if r["id"] == event_id), None)
    if index is None:
        return None

    anchor = rows[index]
    span = STACK_DAYS * DAY_MS
    lo = bisect.bisect_left(times, anchor["time"] - span)
    hi = bisect.bisect_right(times, anchor["time"] + span)

    daily = {d: 0 for d in range(-STACK_DAYS, STACK_DAYS + 1)}
    for j in range(lo, hi):
        if j == index:
            continue
        if haversine(anchor["lat"], anchor["lon"], rows[j]["lat"], rows[j]["lon"]) > EXAMPLE_RADIUS_KM:
            continue
        day = math.floor((times[j] - anchor["time"]) / DAY_MS)
        if -STACK_DAYS <= day <= STACK_DAYS:
            daily[day] += 1

    before = sum(v for d, v in daily.items() if d < 0)
    return {
        "id": event_id,
        "kind": kind,
        "place": anchor["place"],
        "mag": anchor["mag"],
        "time": anchor["time"],
        "foreshocks": before,
        "series": [{"day": d, "count": daily[d]} for d in sorted(daily)],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default=str(DB_PATH))
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    conn = store.connect(args.db)
    rows = load(conn)
    if not rows:
        print("Catalog is empty -- run the backfill first.")
        return 1
    print(f"Loaded {len(rows):,} M{MIN_MAGNITUDE:g}+ events")

    stack, decay, fit, anchors = stack_and_decay(rows)
    print(f"  stacked {anchors} M{ANCHOR_MAGNITUDE:g}+ mainshocks; Omori p = {fit['p']:.2f}")

    fractions = foreshock_fractions(rows)
    print(f"  foreshocks: {fractions['any']}% any larger, {fractions['half']}% "
          f"at least 0.5 larger, {fractions['full']}% at least 1.0 larger")

    examples = [e for e in (example_series(rows, i, k) for i, k in EXAMPLES) if e]
    for e in examples:
        print(f"  example: M{e['mag']} {e['place'][:38]} — {e['foreshocks']} foreshocks")

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "minMagnitude": MIN_MAGNITUDE,
        "anchorMagnitude": ANCHOR_MAGNITUDE,
        "radiusKm": RADIUS_KM,
        "exampleRadiusKm": EXAMPLE_RADIUS_KM,
        "anchors": anchors,
        "foreshockDays": FORESHOCK_DAYS,
        "foreshockKm": FORESHOCK_KM,
        "stack": stack,
        "decay": decay,
        "omori": fit,
        "foreshocks": fractions,
        "examples": examples,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"\nWrote {out} ({out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
