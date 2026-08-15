"""Emit the client-side catalog: one packed binary per magnitude tier.

The site reports M6+ worldwide, which is 7,844 events since 1970 and packs to
84 KB -- so rather than run a query backend we ship the catalog itself and let
the browser do everything.

Layout per tier (struct-of-arrays, little-endian, n = event count):

    offset   0 : Uint32[n]  minutes since 1970-01-01T00:00:00Z
    offset  4n : Int16[n]   latitude  * 100
    offset  6n : Int16[n]   longitude * 100
    offset  8n : Uint16[n]  (depth_km + 100) * 10
    offset 10n : Uint8[n]   magnitude * 10, with bit 7 set on dependent events

Every 2-byte block starts at an even offset and the 4-byte block starts at 0,
so the client can wrap the buffer in typed arrays with no copying.

The declustering flag rides in the magnitude byte's spare high bit rather than
its own array: magnitude * 10 tops out at 99 for a M9.9, so seven bits are
plenty and the flag costs nothing.
"""

from __future__ import annotations

import argparse
import array
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "catalog.sqlite"
OUT_DIR = ROOT / "web" / "public" / "data"

# M6+ answers the front page. M5+ backs the correlations page, where the
# comparisons are within-year -- so the catalogue's changing completeness hits
# every bin equally and cancels, and the extra events buy real statistical power
# (a 1.8% detectable effect against 6.2% at M6+).
TIERS = [5.0, 6.0]

# Tiers at or above this get an ids/places sidecar for the "largest events" list.
DETAIL_MIN_MAGNITUDE = 6.0

MS_PER_MIN = 60_000
DEPTH_OFFSET_KM = 100.0   # ComCat allows depths down to -100 km
DEPTH_SCALE = 10.0
DEPTH_MAX_RAW = 65_535
MAG_MAX_RAW = 127          # seven bits; bit 7 carries the dependent-event flag
DEPENDENT_FLAG = 0x80

# ComCat carries quarry blasts, explosions and ice quakes alongside tectonic
# events. They are a rounding error at M6+ but they are not earthquakes.
EVENT_TYPE = "earthquake"


def tier_name(threshold: float) -> str:
    return f"m{threshold:g}".replace(".", "")


def fetch_tier(conn, threshold: float) -> list[tuple]:
    """Events at or above `threshold` on the homogenised magnitude.

    The threshold is applied to COALESCE(mw, mag), not to mag, so an event whose
    preferred magnitude is Ms 5.9 but whose GCMT solution is Mw 6.1 is included
    -- which is the whole point of the homogenisation, and why the mirror is
    queried below the reporting threshold.
    """
    return conn.execute(
        "SELECT id, time, lat, lon, depth, COALESCE(mw, mag) AS mag, "
        "       mw IS NOT NULL AS homogenised, mainshock, place "
        "FROM events "
        "WHERE COALESCE(mw, mag) >= ? AND (evtype IS NULL OR evtype = ?) "
        "ORDER BY time ASC",
        (threshold, EVENT_TYPE),
    ).fetchall()


def pack(rows: list[tuple]) -> bytes:
    n = len(rows)
    times = array.array("I", [0]) * n
    lats = array.array("h", [0]) * n
    lons = array.array("h", [0]) * n
    depths = array.array("H", [0]) * n
    mags = array.array("B", [0]) * n

    for i, row in enumerate(rows):
        times[i] = max(0, row["time"] // MS_PER_MIN)
        lats[i] = max(-32768, min(32767, round(row["lat"] * 100)))
        lons[i] = max(-32768, min(32767, round(row["lon"] * 100)))
        depth = row["depth"] if row["depth"] is not None else 0.0
        raw = round((depth + DEPTH_OFFSET_KM) * DEPTH_SCALE)
        depths[i] = max(0, min(DEPTH_MAX_RAW, raw))
        raw_mag = max(0, min(MAG_MAX_RAW, round(row["mag"] * 10)))
        # mainshock IS NULL means declustering has not run; treat as independent
        # so the toggle degrades to a no-op rather than emptying the chart.
        if row["mainshock"] == 0:
            raw_mag |= DEPENDENT_FLAG
        mags[i] = raw_mag

    if sys.byteorder != "little":
        for arr in (times, lats, lons, depths):
            arr.byteswap()

    return b"".join(a.tobytes() for a in (times, lats, lons, depths, mags))


def write_tier(conn, threshold: float, out_dir: Path) -> dict:
    rows = fetch_tier(conn, threshold)
    name = tier_name(threshold)

    blob = pack(rows)
    (out_dir / f"{name}.bin").write_bytes(blob)

    # Ids and place names live in a separate lazily-fetched file, parallel to
    # the binary's ordering. They are only needed to name and deep-link an
    # individual event, never to draw a chart, and they are emitted only for
    # thresholds where a "largest events" list is meaningful.
    if threshold >= DETAIL_MIN_MAGNITUDE:
        detail = {
            "ids": [row["id"] for row in rows],
            "places": [row["place"] or "" for row in rows],
        }
        (out_dir / f"{name}.detail.json").write_text(json.dumps(detail, separators=(",", ":")))

    return {
        "threshold": threshold,
        "name": name,
        "count": len(rows),
        "mainshocks": sum(1 for row in rows if row["mainshock"] != 0),
        "homogenised": sum(1 for row in rows if row["homogenised"]),
        "hasDetail": threshold >= DETAIL_MIN_MAGNITUDE,
        "bytes": len(blob),
        "firstTime": rows[0]["time"] if rows else None,
        "lastTime": rows[-1]["time"] if rows else None,
    }


def recent_significant(conn, limit: int = 12) -> list[dict]:
    rows = conn.execute(
        "SELECT id, time, lat, lon, depth, mag, magtype, place FROM events "
        "WHERE mag >= 6.0 AND (evtype IS NULL OR evtype = ?) "
        "ORDER BY time DESC LIMIT ?",
        (EVENT_TYPE, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default=str(DB_PATH))
    ap.add_argument("--out", default=str(OUT_DIR))
    args = ap.parse_args()

    conn = store.connect(args.db)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    total = conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()["n"]
    if total == 0:
        print("Catalog is empty -- run `python3 pipeline/fetch.py --backfill` first.")
        return 1

    tiers = []
    for threshold in TIERS:
        info = write_tier(conn, threshold, out_dir)
        tiers.append(info)
        share = 100 * info["mainshocks"] / info["count"] if info["count"] else 0
        mw = 100 * info["homogenised"] / info["count"] if info["count"] else 0
        print(f"  M{threshold:<4g} {info['count']:>7,} events  {info['bytes'] / 1024:>8.1f} KB"
              f"  ({info['mainshocks']:,} mainshocks, {share:.0f}%; {mw:.0f}% on Mw)")

    meta = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": "USGS ComCat via FDSN event service",
        "minMagnitude": float(store.get_meta(conn, "min_magnitude") or TIERS[0]),
        "eventType": EVENT_TYPE,
        "encoding": {
            "timeUnit": "minutes since 1970-01-01T00:00:00Z",
            "latLonScale": 100,
            "depthOffsetKm": DEPTH_OFFSET_KM,
            "depthScale": DEPTH_SCALE,
            "magScale": 10,
            "magMask": MAG_MAX_RAW,
            "dependentFlag": DEPENDENT_FLAG,
        },
        "declustered": store.get_meta(conn, "declustered_at") is not None,
        "homogenised": store.get_meta(conn, "magnitudes_at") is not None,
        "tiers": tiers,
        "recent": recent_significant(conn),
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"\nWrote {len(tiers)} tiers to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
