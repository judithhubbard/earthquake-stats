"""Link Earthquake Insights posts to the earthquakes they are about.

    python3 pipeline/posts.py

Writes web/public/data/posts.json for the posts page, from two sources:

  * Substack's public archive (/api/v1/archive), read fresh every run, for
    each post's title, date, cover image and whether it is free to read.
  * pipeline/posts.csv, the links between posts and USGS events, kept in the
    repo because most of them can only be read once.

Why "once". A new post is free for its first 30 days, then goes behind the
paywall, and Substack's API only returns the full text of a free post. So
every run reads the full text of every post that is free *now*, collects the
USGS event pages it links to, and writes them to posts.csv. After the paywall
comes down nothing more can be learned, and the rows stay as they were last
read. It runs on a Mac (pipeline/read-posts.sh) twice a day and by hand after
publishing -- not in CI, because Substack's Cloudflare blocks GitHub's servers.
Each post gets dozens of reads in its free month; edits made in that month
are picked up, later ones are not.

Posts from before this existed came from a Substack export (full text of
every post) and from the old Leaflet map's hand-placed points, and are tagged
with that source.

posts.csv columns:

    slug      the post, as in earthquakeinsights.substack.com/p/<slug>
    event     ComCat's preferred event id, or empty for a row that is a
              place rather than an event (lat/lon set) or for a post that
              was read and links to nothing (lat/lon empty)
    role      subject: what the post is about -- recent at the time of
              writing, or the event the title names
              context: an earlier earthquake cited for comparison
    lat,lon,depth,mag,time,place
              the event as USGS had it when linked, so the page needs no
              ComCat lookup; for a place row, a point and a label
    source    body (read here), export, oldmap, title, or hand

**Rows with source "hand" are never overwritten.** To place or correct a
post by hand, delete its rows and add your own with source "hand": either an
event id (the next run fills in lat/lon/mag from ComCat if they are blank) or
a lat/lon and a place label.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "pipeline" / "posts.csv"
OUT_PATH = ROOT / "web" / "public" / "data" / "posts.json"

SUBSTACK = "https://earthquakeinsights.substack.com"
COMCAT = "https://earthquake.usgs.gov/fdsnws/event/1/query"
# Substack answers 429 if asked too quickly; a second apart has been enough.
PAUSE_S = 1.0
HEADERS = {"User-Agent": "stats.earthquakeinsights.com post map"}

REVIEW_TAG = "Research analyses: permanently free to read"
FIELDS = ["slug", "event", "role", "lat", "lon", "depth", "mag", "time", "place", "source"]

# An event page link: earthquake.usgs.gov/earthquakes/eventpage/us7000abcd,
# sometimes with a #tab or /executive after it. Network code, then id.
EVENT_LINK = re.compile(r"earthquake\.usgs\.gov/earthquakes/eventpage/([a-z]{2}[a-z0-9]{6,14})", re.I)
# The magnitude a title names: "M6.3", "Mw7.1", "Magnitude 6.3", "M 7.8".
TITLE_MAG = re.compile(r"\b(?:Mw|M|[Mm]agnitude)\s?(\d(?:\.\d)?)\b")
# Linked events from up to this long before the post are what it is about.
SUBJECT_DAYS = 14


def get_json(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(10 * (attempt + 1))
                continue
            raise


def archive() -> list[dict]:
    posts, offset = [], 0
    while True:
        page = get_json(f"{SUBSTACK}/api/v1/archive?sort=new&offset={offset}&limit=50")
        if not page:
            return posts
        posts += page
        offset += len(page)
        time.sleep(PAUSE_S)


def read_rows() -> dict[str, list[dict]]:
    rows: dict[str, list[dict]] = {}
    if CSV_PATH.exists():
        with CSV_PATH.open(newline="") as f:
            for row in csv.DictReader(f):
                rows.setdefault(row["slug"], []).append(row)
    return rows


def write_rows(rows: dict[str, list[dict]]) -> None:
    order = lambda r: (r.get("role") != "subject", r.get("time", ""), r.get("event", ""))
    flat = [r for slug in sorted(rows) for r in sorted(rows[slug], key=order)]
    with CSV_PATH.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        for r in flat:
            w.writerow({k: r.get(k, "") for k in FIELDS})


_events: dict[str, dict | None] = {}


def comcat_event(event_id: str) -> dict | None:
    """The event as ComCat has it now, under its preferred id. None if gone."""
    if event_id not in _events:
        try:
            f = get_json(f"{COMCAT}?eventid={event_id}&format=geojson")
        except urllib.error.HTTPError as e:
            if e.code not in (404, 409):
                raise
            f = None
        if f:
            lon, lat, depth = f["geometry"]["coordinates"]
            p = f["properties"]
            _events[event_id] = {
                "event": f["id"], "lat": f"{lat:.3f}", "lon": f"{lon:.3f}",
                "depth": f"{depth:.0f}" if depth is not None else "",
                "mag": f"{p['mag']:.1f}", "time": str(p["time"]), "place": p.get("place") or "",
            }
        else:
            _events[event_id] = None
        time.sleep(0.2)
    return _events[event_id]


def post_ms(post: dict) -> int:
    return int(dt.datetime.fromisoformat(post["post_date"].replace("Z", "+00:00")).timestamp() * 1000)


def assign_roles(rows: list[dict], post: dict) -> None:
    """Subject or context, by when each event happened relative to the post.

    Subject: anything from the fortnight before the post. Everything else is
    context -- 1963 Marmara in a post about the 2025 Marmara earthquake, or an
    aftershock added in a later update.

    A post that links nothing recent ("Perspective on the 2025 M7.7 earthquake
    in Myanmar") takes the event its title names; failing that ("One year
    after the February 6 earthquakes"), it is about everything it links.
    Title magnitudes only break that tie: as a general rule they would make
    1963's M6.1 a subject of a post titled M6.2.
    """
    when = post_ms(post)
    for r in rows:
        age_days = (when - int(r["time"])) / 86_400_000
        r["role"] = "subject" if -1 <= age_days <= SUBJECT_DAYS else "context"
    if rows and not any(r["role"] == "subject" for r in rows):
        named = {float(m) for m in TITLE_MAG.findall(post["title"])}
        for r in rows:
            if any(abs(float(r["mag"]) - m) <= 0.15 for m in named):
                r["role"] = "subject"
    if not any(r["role"] == "subject" for r in rows):
        for r in rows:
            r["role"] = "subject"


def read_post(post: dict) -> list[dict] | None:
    """Rows for a post whose full text is free to read now; None if it is not."""
    full = get_json(f"{SUBSTACK}/api/v1/posts/{post['slug']}")
    time.sleep(PAUSE_S)
    if full.get("audience") != "everyone" or not full.get("body_html"):
        return None
    return rows_from_html(post, full["body_html"], "body")


def rows_from_html(post: dict, html: str, source: str) -> list[dict]:
    """A post's rows from its full text: every USGS event page it links to."""
    rows, seen = [], set()
    for event_id in dict.fromkeys(i.lower() for i in EVENT_LINK.findall(html)):
        event = comcat_event(event_id)
        if event is None:
            print(f"  {post['slug']}: {event_id} is not in ComCat; skipped")
            continue
        if event["event"] in seen:      # two of its ids linked
            continue
        seen.add(event["event"])
        rows.append({"slug": post["slug"], **event, "source": source})
    assign_roles(rows, post)
    return rows or [{"slug": post["slug"], "source": source}]


def import_export(directory: Path, posts: list[dict], rows: dict[str, list[dict]]) -> None:
    """Replace title matches and old-map points with the links in a Substack export.

    The export (Settings > Exports) has the full text of every post as
    posts/<id>.<slug>.html. Rows read here or by hand are left alone; so is a
    post that links no event, which keeps whatever placed it.
    """
    files = {f.name.split(".", 1)[1].removesuffix(".html"): f for f in (directory / "posts").glob("*.html")}
    replaced = kept = 0
    for post in posts:
        mine = rows.get(post["slug"], [])
        if any(r.get("source") in ("hand", "body") for r in mine) or post["slug"] not in files:
            continue
        fresh = rows_from_html(post, files[post["slug"]].read_text(encoding="utf-8"), "export")
        if any(r.get("event") for r in fresh):
            rows[post["slug"]] = fresh
            replaced += 1
        elif not any(r.get("lat") for r in mine):
            rows[post["slug"]] = fresh
        else:
            kept += 1
    print(f"Export: {replaced} posts now placed by their own links; "
          f"{kept} link no event and keep their earlier placement")


def fill_hand_rows(rows: list[dict]) -> None:
    """A hand row given only an event id gets the rest from ComCat."""
    for r in rows:
        if r.get("source") == "hand" and r.get("event") and not r.get("lat"):
            event = comcat_event(r["event"])
            if event:
                r.update(event)
                r["role"] = r.get("role") or "subject"


def page_json(posts: list[dict], rows: dict[str, list[dict]]) -> dict:
    events: dict[str, dict] = {}
    out = []
    for p in posts:
        mine = rows.get(p["slug"], [])
        subject, context, place = [], [], None
        for r in mine:
            if r.get("event") and r.get("lat"):
                events[r["event"]] = {
                    "lat": float(r["lat"]), "lon": float(r["lon"]),
                    "depth": float(r["depth"]) if r.get("depth") else None,
                    "mag": float(r["mag"]), "time": int(r["time"]), "place": r["place"],
                }
                (subject if r["role"] == "subject" else context).append(r["event"])
            elif r.get("lat"):
                place = {"lat": float(r["lat"]), "lon": float(r["lon"]), "label": r.get("place") or ""}
        out.append({
            "slug": p["slug"],
            "title": p["title"].strip(),
            "subtitle": (p.get("subtitle") or "").strip(),
            "date": p["post_date"],
            "free": p.get("audience") == "everyone",
            "section": p.get("section_name") or "",
            # The deep reviews of published papers, tagged on Substack; the page
            # offers them as a filter.
            "review": any(t.get("name") == REVIEW_TAG for t in p.get("postTags") or []),
            "cover": p.get("cover_image") or "",
            "events": subject,
            "context": context,
            "place": place,
            "source": sorted({r["source"] for r in mine if r.get("source")}),
        })
    # No build time in here: the file is committed when it changes, and a
    # timestamp would make it change on every run.
    return {"posts": out, "events": events}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true",
                    help="rebuild posts.json from posts.csv and the last archive, without reading posts")
    ap.add_argument("--export", type=Path, metavar="DIR",
                    help="an unzipped Substack export: take links for older posts from its full text")
    args = ap.parse_args()

    rows = read_rows()
    cache = ROOT / "data" / "substack-archive.json"
    if args.offline:
        posts = json.loads(cache.read_text())
    else:
        posts = archive()
        cache.parent.mkdir(exist_ok=True)
        cache.write_text(json.dumps(posts))
        print(f"{len(posts)} posts in the archive")
        for post in posts:
            if post.get("audience") != "everyone":
                continue
            if any(r.get("source") == "hand" for r in rows.get(post["slug"], [])):
                continue
            fresh = read_post(post)
            if fresh is None:
                continue
            linked = sum(1 for r in fresh if r.get("event"))
            # A post that links no event keeps whatever placed it before -- the
            # export, the old map, or a title match -- rather than falling off.
            if not linked and any(r.get("lat") for r in rows.get(post["slug"], [])):
                continue
            if rows.get(post["slug"]) != fresh:
                print(f"  read {post['slug']}: {linked} event(s) linked")
            rows[post["slug"]] = fresh
        if args.export:
            import_export(args.export, posts, rows)
        for slug_rows in rows.values():
            fill_hand_rows(slug_rows)
        write_rows(rows)

    unplaced = [p["title"] for p in posts
                if not any(r.get("lat") for r in rows.get(p["slug"], []))
                and TITLE_MAG.search(p["title"])]
    for title in unplaced[:20]:
        print(f"::notice::Not on the map (names a magnitude but links no event): {title}")

    OUT_PATH.write_text(json.dumps(page_json(posts, rows), separators=(",", ":")))
    print(f"Wrote {OUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
