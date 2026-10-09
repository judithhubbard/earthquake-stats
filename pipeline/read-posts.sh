#!/bin/bash
# Read new Earthquake Insights posts and push their USGS links to GitHub.
#
# Runs on a Mac, not in CI: Substack's Cloudflare blocks GitHub's servers
# outright (403 on the API, the feed and the pages alike, whatever the
# user agent), so the build cannot read posts itself. pipeline/posts.py has
# the rest of the story.
#
# Works in its own clone, not the Dropbox working copy, so it never touches
# work in progress and Dropbox never syncs a half-done rebase. Started by
#   - launchd, twice a day (~/Library/LaunchAgents/com.earthquakeinsights.posts.plist)
#   - "Update posts map.command", by hand after publishing
# Install or reinstall both with:  pipeline/read-posts.sh --install

set -euo pipefail

HOME_DIR="$HOME/Library/Application Support/earthquake-posts"
CLONE="$HOME_DIR/earthquake-stats"
REMOTE="https://github.com/judithhubbard/earthquake-stats.git"
PYTHON="${PYTHON:-/usr/local/bin/python3}"
LABEL="com.earthquakeinsights.posts"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/earthquake-posts.log"

if [[ "${1:-}" == "--install" ]]; then
  mkdir -p "$HOME_DIR" "$(dirname "$PLIST")"
  cp "$0" "$HOME_DIR/read-posts.sh"
  chmod +x "$HOME_DIR/read-posts.sh"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$HOME_DIR/read-posts.sh</string></array>
  <!-- A missed time (asleep, lid shut) runs once on wake. -->
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "Installed: runs at 9:00 and 21:00; log at $LOG"
  exit 0
fi

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
mkdir -p "$HOME_DIR"
if [[ ! -d "$CLONE/.git" ]]; then
  git clone -q "$REMOTE" "$CLONE"
fi
cd "$CLONE"
# A dedicated clone: whatever is here is ours, so match the remote exactly.
git fetch -q origin main
git reset -q --hard origin/main

"$PYTHON" pipeline/posts.py

if git diff --quiet -- pipeline/posts.csv web/public/data/posts.json; then
  echo "No new posts or links."
  exit 0
fi
git add pipeline/posts.csv web/public/data/posts.json
git commit -q -m "Link new posts to their earthquakes"
# CI commits magnitudes now and then; rebase over them and try again.
for attempt in 1 2 3; do
  if git push -q origin HEAD:main; then
    echo "Pushed. The site rebuilds in a couple of minutes."
    exit 0
  fi
  git pull -q --rebase origin main
done
echo "Could not push after three tries." >&2
exit 1
