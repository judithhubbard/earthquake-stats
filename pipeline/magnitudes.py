"""Homogenise magnitudes to Mw, using values ComCat holds but does not prefer.

    python3 pipeline/magnitudes.py                 # all years
    python3 pipeline/magnitudes.py --start 1976 --end 1995

ComCat's *preferred* magnitude for a large earthquake changed character over the
catalogue's life. Before 1984, 81% of M6+ events are preferred as Ms or mb;
from 1984 onward it is Mw for essentially all of them. Because Ms and mb run
low against Mw for these events -- and mb saturates above ~6.5 -- the M6+ count
in the early years is depressed by roughly a third, which looks exactly like a
catalogue that is missing events and is not.

It is not missing them. ComCat carries GCMT and ISC-GEM Mw for most of these
events; they are simply not the preferred solution. The 1977 Philippines event
usp0000myv is preferred Ms 7.0 and also carries Mw 7.23 (ISC-GEM) and Mwc 7.2
(GCMT). Harvesting those and preferring Mw where it exists lifts 1977 from 86
M6+ events to 136, and trims 1985 from 162 to 148 -- it closes the gap from both
directions, which a simple inflation would not.

The result lands in `events.mw` / `events.mw_type`; the preferred magnitude in
`events.mag` is left untouched so the two remain comparable.
"""

from __future__ import annotations

import argparse
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store
import usgs

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "catalog.sqlite"

QML = "{http://quakeml.org/xmlns/bed/1.2}"
ANSS = "{http://anss.org/xmlns/catalog/0.1}"

# Preference order among moment magnitudes: W-phase, then centroid (GCMT), then
# body-wave and regional moment solutions, then a generic Mw (ISC-GEM re-analysis).
MW_PREFERENCE = ("mww", "mwc", "mwb", "mwr", "mw")

# Fetch below the reporting threshold: homogenising shifts magnitudes by ~0.1-0.2,
# so events that should cross M6.0 sit just under it before the switch.
MIN_MAGNITUDE = 5.5
CATALOG_START = 1970


def event_id(event: ET.Element) -> str | None:
    """ComCat id for an event, from the ANSS attributes or the publicID.

    The `catalog:eventid` attribute is the id *without* its network prefix --
    `p0000sa7`, where the ComCat id is `usp0000sa7`. The prefix lives in
    `catalog:eventsource`, so the two have to be concatenated. Using the bare
    attribute matches nothing, and an UPDATE that matches nothing is silent.
    """
    eid = event.get(ANSS + "eventid")
    source = event.get(ANSS + "eventsource")
    if eid and source:
        return f"{source}{eid}"
    public = event.get("publicID") or ""
    if "eventid=" in public:
        return public.split("eventid=", 1)[1].split("&", 1)[0]
    return eid or None


def best_mw(event: ET.Element) -> tuple[float, str] | None:
    """The most authoritative moment magnitude on an event, if it has one."""
    found: dict[str, float] = {}
    for magnitude in event.findall(QML + "magnitude"):
        kind = magnitude.find(QML + "type")
        value = magnitude.find(QML + "mag/" + QML + "value")
        if kind is None or value is None or not kind.text:
            continue
        try:
            # setdefault keeps the first of a repeated type, which is the
            # contributor ComCat lists first.
            found.setdefault(kind.text.strip().lower(), float(value.text))
        except (TypeError, ValueError):
            continue
    for kind in MW_PREFERENCE:
        if kind in found:
            return found[kind], kind
    return None


def harvest_year(year: int) -> list[tuple[float, str, str]]:
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    body = usgs.fetch_quakeml(start, end, MIN_MAGNITUDE)
    if not body.strip():
        return []

    rows = []
    root = ET.fromstring(body)
    for event in root.iter(QML + "event"):
        eid = event_id(event)
        if not eid:
            continue
        best = best_mw(event)
        if best is None:
            continue
        rows.append((best[0], best[1], eid))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default=str(DB_PATH))
    ap.add_argument("--start", type=int, default=CATALOG_START)
    ap.add_argument("--end", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--pause", type=float, default=1.0)
    args = ap.parse_args()

    conn = store.connect(args.db)
    total = 0

    for year in range(args.start, args.end + 1):
        try:
            rows = harvest_year(year)
        except Exception as exc:  # noqa: BLE001 - one bad year should not lose the rest
            print(f"  {year}: FAILED ({exc})", flush=True)
            continue
        # Report rows actually changed, not rows offered: an id-format mismatch
        # makes every UPDATE a silent no-op, which is exactly what happened when
        # the network prefix was missing from the event id.
        before = conn.total_changes
        conn.executemany("UPDATE events SET mw = ?, mw_type = ? WHERE id = ?", rows)
        conn.commit()
        applied = conn.total_changes - before
        total += applied
        note = "" if applied == len(rows) else f"  [{len(rows) - applied} unmatched]"
        print(f"  {year}: {applied:>5} events given an Mw  (total {total:,}){note}", flush=True)
        time.sleep(args.pause)

    store.set_meta(conn, "magnitudes_at", datetime.now(timezone.utc).isoformat())
    conn.commit()

    covered = conn.execute(
        "SELECT COUNT(*) AS n FROM events WHERE mw IS NOT NULL AND mag >= 5.5").fetchone()["n"]
    eligible = conn.execute(
        "SELECT COUNT(*) AS n FROM events WHERE mag >= 5.5").fetchone()["n"]
    print(f"\n{covered:,} of {eligible:,} M5.5+ events now carry an Mw "
          f"({100 * covered / max(1, eligible):.0f}%).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
