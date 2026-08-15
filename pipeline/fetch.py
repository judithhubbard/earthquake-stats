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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--backfill", action="store_true",
                    help="fetch full history instead of an incremental update")
    ap.add_argument("--minmag", type=float, default=MIN_MAGNITUDE)
    ap.add_argument("--start", default=CATALOG_START.strftime("%Y-%m-%d"))
    ap.add_argument("--db", default=str(DB_PATH))
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

    store.set_meta(conn, "last_run", now.isoformat())
    store.set_meta(conn, "min_magnitude", str(args.minmag))
    conn.commit()

    total = conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()["n"]
    print(f"\nIngested {count:,} rows. Catalog now holds {total:,} events.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
