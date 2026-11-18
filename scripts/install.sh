#!/bin/sh
# Copies mods/snooze into Herdr's mods folder. Herdr reloads mods when files there change.
# It doesn't see edits behind a symlink, so run this after each change instead of linking.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
dest="${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods/snooze"
[ -L "$dest" ] && rm "$dest"
mkdir -p "$dest"
rsync -a --delete --exclude '*.d.ts' --exclude jsconfig.json "$here/mods/snooze/" "$dest/"
herdr-app check "$dest"
