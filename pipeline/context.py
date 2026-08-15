"""Fetch the outside datasets the "do earthquakes correlate with…?" page needs.

    python3 pipeline/context.py

Three small, stable, public series, baked into `web/public/data/context.json`
at build time rather than fetched by the browser -- they change once a month at
most, and a page that answers a question should not fail because a third-party
host is down.

  * Global temperature -- NASA GISTEMP v4 land-ocean index, annual mean.
  * Solar activity     -- WDC-SILSO (Royal Observatory of Belgium), yearly mean
                          total sunspot number.
  * Induced seismicity -- ComCat M3+ inside Oklahoma, the one place on this site
                          where the answer to "did something change?" is yes.

Any source that fails is simply omitted; the page drops that panel rather than
breaking.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import usgs

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "data" / "context.json"

GISTEMP_URL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"
SILSO_URL = "https://www.sidc.be/SILSO/DATA/SN_y_tot_V2.0.csv"

# Oklahoma, generously bounded. The injection-induced sequence is centred on the
# north-central part of the state but spills into Kansas and the panhandle.
OKLAHOMA = {"latMin": 33.5, "latMax": 37.2, "lonMin": -103.1, "lonMax": -94.4}
OKLAHOMA_MIN_MAGNITUDE = 3.0
OKLAHOMA_START = 2000


def _get(url: str, timeout: int = 120) -> str:
    request = urllib.request.Request(
        url, headers={"User-Agent": usgs.USER_AGENT, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    return raw.decode("utf-8", errors="replace")


def temperature() -> dict:
    """GISTEMP annual global mean anomaly, °C relative to 1951-1980."""
    body = _get(GISTEMP_URL)
    # The file opens with a title line before the real header.
    lines = body.splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("Year,"))
    reader = csv.DictReader(lines[start:])

    years: dict[str, float] = {}
    for row in reader:
        year, annual = row.get("Year"), row.get("J-D")
        if not year or not annual or annual.strip() in {"", "***"}:
            continue
        try:
            years[str(int(year))] = float(annual)
        except ValueError:
            continue
    return {
        "label": "Global temperature anomaly",
        "unit": "°C vs 1951–1980",
        "source": "NASA GISTEMP v4",
        "url": "https://data.giss.nasa.gov/gistemp/",
        "years": years,
    }


def sunspots() -> dict:
    """SILSO yearly mean total sunspot number."""
    body = _get(SILSO_URL)
    years: dict[str, float] = {}
    for row in csv.reader(io.StringIO(body), delimiter=";"):
        if len(row) < 2:
            continue
        try:
            # The year column is mid-year (1976.5); the value is -1 when missing.
            year = int(float(row[0]))
            value = float(row[1])
        except ValueError:
            continue
        if value >= 0:
            years[str(year)] = value
    return {
        "label": "Sunspot number",
        "unit": "yearly mean",
        "source": "WDC-SILSO, Royal Observatory of Belgium",
        "url": "https://www.sidc.be/SILSO/",
        "years": years,
    }


def oklahoma() -> dict:
    """Annual ComCat M3+ counts inside the Oklahoma box."""
    start = datetime(OKLAHOMA_START, 1, 1, tzinfo=timezone.utc)
    end = datetime.now(timezone.utc)

    counts: dict[str, int] = {}
    for batch in usgs.iter_events(start, end, OKLAHOMA_MIN_MAGNITUDE, window_days=365):
        for row in batch:
            if row.get("type") not in (None, "", "earthquake"):
                continue
            try:
                lat, lon = float(row["latitude"]), float(row["longitude"])
            except (TypeError, ValueError, KeyError):
                continue
            if not (OKLAHOMA["latMin"] <= lat <= OKLAHOMA["latMax"]):
                continue
            if not (OKLAHOMA["lonMin"] <= lon <= OKLAHOMA["lonMax"]):
                continue
            stamp = usgs.parse_time(row.get("time"))
            if stamp is None:
                continue
            year = datetime.fromtimestamp(stamp / 1000, timezone.utc).year
            counts[str(year)] = counts.get(str(year), 0) + 1

    return {
        "label": "Oklahoma earthquakes",
        "unit": f"M{OKLAHOMA_MIN_MAGNITUDE:g}+ per year",
        "source": "USGS ComCat",
        "url": "https://earthquake.usgs.gov/",
        "box": OKLAHOMA,
        "years": counts,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    context: dict = {"generated": datetime.now(timezone.utc).isoformat()}
    for name, build in (("temperature", temperature), ("sunspots", sunspots),
                        ("oklahoma", oklahoma)):
        try:
            series = build()
        except Exception as exc:  # noqa: BLE001 - one bad source must not lose the rest
            print(f"  {name}: FAILED ({exc})")
            continue
        context[name] = series
        span = sorted(series["years"])
        print(f"  {name}: {len(series['years'])} years, {span[0]}–{span[-1]}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(context, separators=(",", ":")))
    print(f"\nWrote {out} ({out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
