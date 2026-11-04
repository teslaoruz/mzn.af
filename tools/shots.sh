#!/usr/bin/env bash
# Re-take every screenshot and bill picture on mzn.af from the real app, against the demo shop.
# Run after a release that changes how the app looks. Needs the app repo, ~/.dotnet, Chrome and
# ImageMagick (magick). Nothing here is a mockup: the pages are the app's own headless render
# (tests/Desktop.Tests, MIZAN_WALK) of the DemoSeed book, a year of an invented Kabul shop.
set -euo pipefail
APP="${APP:-/data/Projects/accounting app}"
SITE="$(cd "$(dirname "$0")/.." && pwd)"
DOTNET="${DOTNET:-$HOME/.dotnet/dotnet}"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
IMG="$SITE/static/img"

cd "$APP"
"$DOTNET" build AccountingApp.sln -v q
XDG_DATA_HOME="$W/xdg" "$DOTNET" run --project src/Tools/DemoSeed -- --plain "$W/demo.db"
XDG_DATA_HOME="$W/xdg" MIZAN_WALK="$W/walk" MIZAN_WALK_DB="$W/demo.db" "$DOTNET" run --no-build --project tests/Desktop.Tests

cd "$W/walk"
for l in fa ps en; do
  # Walk index -> site name. The first 16 indexes are the same pages in every language.
  for pair in 05:home 06:sell 13:bills 14:inventory 16:finance 31:reports; do
    n=${pair%%:*}; k=${pair##*:}
    f=$(ls "$l-$n-"*.png | head -1)
    [[ $k == reports ]] && f=$(ls "$l-"*-reports.summary.png | head -1)
    magick "$f" -quality 80 "$IMG/$l-$k.webp"
    magick "$f" -resize 760x -quality 78 "$IMG/$l-$k-760.webp"
  done
  # The demo customer's phone looks like a real Afghan number, so it is masked before publishing.
  sed -E 's/07[0-9]{2} [0-9]{3} [0-9]{3}/07•• ••• •••/g' "bill-$l.html" > "bill-$l.red.html"
  google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=820,620 --screenshot="$W/bill-$l.png" "file://$W/walk/bill-$l.red.html" 2>/dev/null
  magick "$W/bill-$l.png" -crop 1588x1100+26+108 +repage -quality 82 "$IMG/$l-bill.webp"
done
f=$(ls fa-*-dark.fin.OverviewTab.png | head -1)
magick "$f" -quality 80 "$IMG/fa-dark.webp"; magick "$f" -resize 760x -quality 78 "$IMG/fa-dark-760.webp"

cd "$SITE" && node build.mjs --og
echo "Done. Look at every picture before deploying: walk indexes move when the app adds a page."
