"""SQLite canonical store for ComCat events.

One row per ComCat event id. Magnitudes and locations get revised for weeks
after an event, so ingest is an upsert keyed on id and incremental refreshes
run on `updatedafter` rather than a time cursor -- a time cursor would freeze
stale magnitudes for anything already ingested.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id        TEXT PRIMARY KEY,
    time      INTEGER NOT NULL,   -- epoch ms, UTC
    lat       REAL    NOT NULL,
    lon       REAL    NOT NULL,
    depth     REAL,               -- km
    mag       REAL    NOT NULL,
    magtype   TEXT,
    place     TEXT,
    evtype    TEXT,               -- 'earthquake', 'quarry blast', ...
    status    TEXT,               -- 'automatic' | 'reviewed'
    net       TEXT,
    updated   INTEGER,            -- epoch ms, UTC
    mainshock INTEGER,            -- 1 = independent, 0 = dependent, NULL = not yet run
    mw        REAL,               -- homogenised moment magnitude, NULL if none exists
    mw_type   TEXT                -- which Mw flavour mw came from (mww/mwc/mwb/mw)
);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(time);
CREATE INDEX IF NOT EXISTS idx_events_mag  ON events(mag);
CREATE INDEX IF NOT EXISTS idx_events_upd  ON events(updated);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""

UPSERT = """
INSERT INTO events (id, time, lat, lon, depth, mag, magtype, place, evtype, status, net, updated)
VALUES (:id, :time, :lat, :lon, :depth, :mag, :magtype, :place, :evtype, :status, :net, :updated)
ON CONFLICT(id) DO UPDATE SET
    time=excluded.time, lat=excluded.lat, lon=excluded.lon, depth=excluded.depth,
    mag=excluded.mag, magtype=excluded.magtype, place=excluded.place,
    evtype=excluded.evtype, status=excluded.status, net=excluded.net,
    updated=excluded.updated
"""


def connect(path: str | Path) -> sqlite3.Connection:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    _migrate(conn)
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after a mirror was first built."""
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(events)")}
    for name, decl in (("mainshock", "INTEGER"), ("mw", "REAL"), ("mw_type", "TEXT")):
        if name not in existing:
            conn.execute(f"ALTER TABLE events ADD COLUMN {name} {decl}")
    conn.commit()


def _to_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def upsert(conn: sqlite3.Connection, rows: list[dict], parse_time) -> int:
    """Upsert FDSN CSV rows. Returns the number accepted.

    Rows missing a time, position or magnitude are dropped -- a cumulative count
    cannot place them, and ComCat does emit the occasional magnitude-less entry.
    """
    payload = []
    for row in rows:
        lat, lon, mag = _to_float(row.get("latitude")), _to_float(row.get("longitude")), _to_float(row.get("mag"))
        when = parse_time(row.get("time"))
        if row.get("id") is None or when is None or lat is None or lon is None or mag is None:
            continue
        payload.append({
            "id": row["id"],
            "time": when,
            "lat": lat,
            "lon": lon,
            "depth": _to_float(row.get("depth")),
            "mag": mag,
            "magtype": row.get("magType"),
            "place": row.get("place"),
            "evtype": row.get("type"),
            "status": row.get("status"),
            "net": row.get("net"),
            "updated": parse_time(row.get("updated")),
        })
    if payload:
        conn.executemany(UPSERT, payload)
    return len(payload)


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
