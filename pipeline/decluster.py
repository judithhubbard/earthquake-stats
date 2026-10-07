"""Flag dependent events (aftershocks) in the local mirror.

    python3 pipeline/decluster.py

Nearest-neighbour declustering (Zaliapin & Ben-Zion) over the M6+ catalog;
the method, its parameters and why it was chosen are in nearest.py. The flags
go in `events.mainshock_nn`, which build.py emits for every tier.

Gardner-Knopoff windows did this job until October 2026, for every magnitude,
into `events.mainshock`. Their 2.5-3 year time windows, widened to global
distances, removed background along with aftershocks, and nearest neighbour
replaced them for M6+. They lived on below M6 only for the correlations page's
M5+ panels; when that page was taken down there was nothing left for them to
do, so they went too. They are in git history (pipeline/decluster.py before
this note) if a comparison is ever wanted. The `mainshock` column is left as
the windows last wrote it and nothing reads it.
"""

from __future__ import annotations

import argparse
import sys
import time as timer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import nearest
import store

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "catalog.sqlite"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default=str(DB_PATH))
    args = ap.parse_args()

    conn = store.connect(args.db)
    # The homogenised magnitude the site reports, so the links and the "at
    # least as large" rule match what the reader sees.
    rows = conn.execute(
        "SELECT id, time, lat, lon, COALESCE(depth, 10) AS depth, COALESCE(mw, mag) AS mag "
        "FROM events WHERE evtype = 'earthquake' AND COALESCE(mw, mag) >= ? ORDER BY time ASC",
        (nearest.MIN_MAGNITUDE,),
    ).fetchall()
    if not rows:
        print("Catalog is empty -- run `python3 pipeline/fetch.py --backfill` first.")
        return 1

    print(f"Nearest-neighbour over {len(rows):,} M{nearest.MIN_MAGNITUDE:g}+ events…", flush=True)
    started = timer.monotonic()
    mags = [r["mag"] for r in rows]
    eta, parent = nearest.nearest_neighbours(
        [r["time"] for r in rows], [r["lat"] for r in rows], [r["lon"] for r in rows],
        [r["depth"] for r in rows], mags)
    log_threshold = nearest.fit_threshold(eta)
    flags = nearest.classify(eta, parent, mags, log_threshold)

    conn.execute("UPDATE events SET mainshock_nn = NULL")
    conn.executemany(
        "UPDATE events SET mainshock_nn = ? WHERE id = ?",
        [(1 if flag else 0, row["id"]) for row, flag in zip(rows, flags)],
    )
    store.set_meta(conn, "nn_log_eta0", f"{log_threshold:.4f}")
    store.set_meta(conn, "declustered_at", str(int(timer.time())))
    conn.commit()

    print(f"  log10 eta0 = {log_threshold:.2f} in {timer.monotonic() - started:.0f}s")
    for threshold in (6.0, 7.0, 8.0):
        group = [f for f, m in zip(flags, mags) if m >= threshold]
        print(f"  M{threshold:<4g} {sum(group):>6,} / {len(group):>6,} kept "
              f"({100 * sum(group) / max(1, len(group)):.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
