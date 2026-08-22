"""Thin, polite client for the USGS FDSN event service.

Stdlib only. The service caps any single query at 20,000 rows and will return
400 past that, so `iter_events` splits its time window whenever a response comes
back at the cap. It also falls over under genuinely large requests -- a M2.5+
count across the full catalog returns an RDS "table is full" error -- so every
request retries with backoff and windows stay modest.
"""

from __future__ import annotations

import csv
import gzip
import json
import io
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Iterator

BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query"
ROW_CAP = 20_000
USER_AGENT = "earthquake-stats/0.1 (+https://earthquakeinsights.substack.com)"

# FDSN CSV columns we keep. The service emits many more.
FIELDS = ("time", "latitude", "longitude", "depth", "mag", "magType", "id",
          "updated", "place", "type", "status", "net")


def _get(params: dict, *, retries: int = 5) -> str:
    """GET with backoff. Returns the decoded body."""
    url = f"{BASE}?{urllib.parse.urlencode(params)}"
    delay = 2.0
    last: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"}
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                raw = resp.read()
                if resp.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return raw.decode("utf-8")
        except urllib.error.HTTPError as exc:
            # 404 from FDSN means "no data matched", which is not an error here.
            if exc.code == 404:
                return ""
            last = exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
        if attempt < retries - 1:
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"USGS request failed after {retries} tries: {url}") from last


def alias_map(start: datetime, end: datetime, minmagnitude: float) -> dict[str, str]:
    """{superseded id: the id ComCat now prefers}, for one time window.

    ComCat sometimes carries a regional or tsunami-warning solution as its own
    event for the first minutes after an earthquake, then associates it with
    the authoritative one. The GeoJSON `ids` property lists every id an event
    answers to, so anything in there that is not the event's own id is an alias
    that should not exist separately in a mirror.

    GeoJSON rather than CSV because the CSV format does not carry `ids` at all,
    which is why ingest could not see the merge happen.
    """
    params = {
        "format": "geojson",
        "starttime": start.strftime("%Y-%m-%dT%H:%M:%S"),
        "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"),
        "minmagnitude": minmagnitude,
        "orderby": "time",
    }
    body = _get(params)
    if not body.strip():
        return {}
    out: dict[str, str] = {}
    for feature in json.loads(body).get("features", []):
        preferred = feature.get("id")
        if not preferred:
            continue
        for alias in (feature.get("properties", {}).get("ids") or "").strip(",").split(","):
            if alias and alias != preferred:
                out[alias] = preferred
    return out


def _parse_csv(body: str) -> list[dict]:
    if not body.strip():
        return []
    reader = csv.DictReader(io.StringIO(body))
    return [{k: row.get(k) for k in FIELDS} for row in reader]


def _fetch_window(start: datetime, end: datetime, minmag: float,
                  updatedafter: datetime | None) -> list[dict]:
    params = {
        "format": "csv",
        "starttime": start.strftime("%Y-%m-%dT%H:%M:%S"),
        "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"),
        "minmagnitude": minmag,
        "orderby": "time-asc",
        "limit": ROW_CAP,
    }
    if updatedafter is not None:
        params["updatedafter"] = updatedafter.strftime("%Y-%m-%dT%H:%M:%S")
    return _parse_csv(_get(params))


def iter_events(start: datetime, end: datetime, minmag: float, *,
                updatedafter: datetime | None = None,
                window_days: int = 365,
                pause: float = 0.4) -> Iterator[list[dict]]:
    """Yield batches of events between `start` and `end`.

    Windows that come back at the row cap are halved and retried, so the caller
    never silently loses events to truncation.
    """
    pending: list[tuple[datetime, datetime]] = []
    cursor = start
    while cursor < end:
        stop = min(cursor + timedelta(days=window_days), end)
        pending.append((cursor, stop))
        cursor = stop
    pending.reverse()  # pop() walks forward in time

    while pending:
        lo, hi = pending.pop()
        rows = _fetch_window(lo, hi, minmag, updatedafter)
        if len(rows) >= ROW_CAP:
            mid = lo + (hi - lo) / 2
            if mid <= lo or mid >= hi:
                raise RuntimeError(f"cannot split window {lo}..{hi} below the row cap")
            # push in reverse so the earlier half is processed first
            pending.append((mid, hi))
            pending.append((lo, mid))
            continue
        if rows:
            yield rows
        time.sleep(pause)


def fetch_quakeml(start: datetime, end: datetime, minmag: float) -> str:
    """QuakeML for a window, including every contributed magnitude.

    The CSV and GeoJSON formats only ever carry the preferred magnitude, which
    for pre-1984 events is usually Ms or mb. QuakeML with `includeallmagnitudes`
    is the only way to reach the GCMT and ISC-GEM Mw values that ComCat holds
    but does not prefer. It is heavy -- roughly 3 MB per year at M5.5+ -- so
    callers should window it and not ask for more magnitude range than they need.
    """
    return _get({
        "format": "quakeml",
        "includeallmagnitudes": "true",
        "starttime": start.strftime("%Y-%m-%dT%H:%M:%S"),
        "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"),
        "minmagnitude": minmag,
        "orderby": "time-asc",
    })


def parse_time(value: str | None) -> int | None:
    """ISO8601 -> epoch milliseconds (UTC)."""
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)
