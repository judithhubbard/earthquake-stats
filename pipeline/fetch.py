"""Backfill and incrementally refresh the local ComCat mirror.

    python3 pipeline/fetch.py --backfill          # full history, once
    python3 pipeline/fetch.py                     # incremental, safe to cron

Incremental runs pull everything ComCat has *revised* since the last run
(minus a lookback margin), which catches magnitude revisions to old events as
well as new ones.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import store
import usgs

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "catalog.sqlite"

# Catalog floor. Global Mc sits near M4.5 for the modern ComCat era; going
# lower buys mostly US-regional events that would distort a global count.
MIN_MAGNITUDE = 4.5
CATALOG_START = datetime(1970, 1, 1, tzinfo=timezone.utc)

# Incremental runs re-ask for anything revised in this window. Generous, because
# missing a revision is silent while re-fetching one is just bandwidth.
LOOKBACK_DAYS = 7

# How far back to look for events ComCat has merged since we ingested them.
# Associations happen within minutes to hours, so a week is a wide margin. It
# costs one request of about 18 KB gzipped per run, against 70 KB for a month
# and 6 KB for two days -- cheap enough to run every time rather than gate.
RECONCILE_DAYS = 7


def backfill(conn, minmag: float, start: datetime, end: datetime) -> int:
    total = 0
    for batch in usgs.iter_events(start, end, minmag, window_days=365):
        total += store.upsert(conn, batch, usgs.parse_time)
        conn.commit()
        stamp = usgs.parse_time(batch[0]["time"])
        year = datetime.fromtimestamp(stamp / 1000, timezone.utc).year if stamp else "?"
        print(f"  {year}: +{len(batch):>6}  (total {total:,})", flush=True)
    return total


def incremental(conn, minmag: float, since: datetime, end: datetime) -> int:
    """Re-pull every event revised since `since`, across all of catalog history."""
    total = 0
    # updatedafter filters server-side, so a single wide time window is fine:
    # the result set is small regardless of how much history it spans.
    for batch in usgs.iter_events(CATALOG_START, end, minmag,
                                  updatedafter=since,
                                  window_days=100_000):
        total += store.upsert(conn, batch, usgs.parse_time)
        conn.commit()
        print(f"  +{len(batch):>6} revised/new (total {total:,})", flush=True)
    return total


def reconcile(conn, minmag: float, end: datetime, days: int = RECONCILE_DAYS) -> int:
    """Drop rows for events ComCat has since merged into another. Returns the count.

    ComCat can carry a regional or tsunami-warning solution as its own event
    for the first minutes after an earthquake and associate it with the
    authoritative one later. Ingest is an upsert keyed on id, so the superseded
    id stays in the mirror forever: the same earthquake twice, at two
    magnitudes, both counted and both declustered as independent.

    That happened on 22 August 2026. The Alaska Tsunami Warning Center's rapid
    solution for a Scotia Sea earthquake, attk5wls at M6.7 mwp, was merged into
    us6000tmrw at M6.2 Mww. The mirror kept both, 25 km and three seconds
    apart, and the site reported the superseded magnitude as its latest M6+.

    Only ever deletes an alias when the preferred event is also held, so this
    cannot remove an earthquake: the worst case is that an alias survives until
    the run that ingests its replacement.
    """
    start = end - timedelta(days=days)
    aliases = usgs.alias_map(start, end, minmag)
    if not aliases:
        return 0

    ids = list(aliases)
    doomed: list[tuple[str, str]] = []
    # Chunked: SQLite's default limit on host parameters is 999.
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        marks = ",".join("?" * len(chunk))
        held = {row["id"] for row in
                conn.execute(f"SELECT id FROM events WHERE id IN ({marks})", chunk)}
        for alias in held:
            preferred = aliases[alias]
            if conn.execute("SELECT 1 FROM events WHERE id = ?", (preferred,)).fetchone():
                doomed.append((alias, preferred))

    for alias, preferred in doomed:
        conn.execute("DELETE FROM events WHERE id = ?", (alias,))
        print(f"  merged: {alias} -> {preferred}", flush=True)
    conn.commit()
    return len(doomed)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--backfill", action="store_true",
                    help="fetch full history instead of an incremental update")
    ap.add_argument("--minmag", type=float, default=MIN_MAGNITUDE)
    ap.add_argument("--start", default=CATALOG_START.strftime("%Y-%m-%d"))
    ap.add_argument("--db", default=str(DB_PATH))
    ap.add_argument("--reconcile-days", type=int, default=RECONCILE_DAYS,
                    help="window to check for events ComCat has merged")
    args = ap.parse_args()

    conn = store.connect(args.db)
    now = datetime.now(timezone.utc)
    start = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)

    if args.backfill:
        print(f"Backfilling M{args.minmag}+ from {start:%Y-%m-%d} to {now:%Y-%m-%d}")
        count = backfill(conn, args.minmag, start, now)
    else:
        last = store.get_meta(conn, "last_run")
        since = (datetime.fromisoformat(last) if last else now - timedelta(days=30))
        since -= timedelta(days=LOOKBACK_DAYS)
        print(f"Incremental M{args.minmag}+ for revisions since {since:%Y-%m-%d %H:%M}Z")
        count = incremental(conn, args.minmag, since, now)
        merged = reconcile(conn, args.minmag, now, args.reconcile_days)
        if merged:
            print(f"Removed {merged} event(s) ComCat has merged into another.")

    store.set_meta(conn, "last_run", now.isoformat())
    store.set_meta(conn, "min_magnitude", str(args.minmag))
    conn.commit()

    total = conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()["n"]
    print(f"\nIngested {count:,} rows. Catalog now holds {total:,} events.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
