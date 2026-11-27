#!/bin/sh
# Downloads the pinned Marine Park web build (MarinePark-<version>-web.zip from the game's GitHub
# release) and unzips it into the directory given as $1. Used by the Dockerfile's marinepark stage.
#
#   VERSION_FILE        file holding the pinned version (default: marine-park.version)
#   MARINE_PARK_REPO    owner/name of the game repo (default: mattlol85/Marine-Park)
#   MARINE_PARK_REQUIRED  "true" makes a missing token an error instead of a skip (set in CI)
#   /run/secrets/marine_park_token  GitHub token that can read the (private) game repo's releases
#
# With no version pinned, or no token outside CI, it leaves $1 empty and the site's Marine-Park tab
# says the game isn't installed. A pinned version that can't be fetched always fails the build.
set -eu

OUT="${1:?usage: fetch-marine-park.sh <output-dir>}"
VERSION_FILE="${VERSION_FILE:-marine-park.version}"
REPO="${MARINE_PARK_REPO:-mattlol85/Marine-Park}"
REQUIRED="${MARINE_PARK_REQUIRED:-false}"
TOKEN_FILE=/run/secrets/marine_park_token

mkdir -p "$OUT"

# First line that isn't blank or a comment, without whitespace or a leading "v".
VERSION=$(sed -e 's/#.*//' -e 's/[[:space:]]//g' "$VERSION_FILE" | sed -n '/./{p;q;}' | sed 's/^v//')
if [ -z "$VERSION" ]; then
  echo "marine-park: no version pinned in $VERSION_FILE; building without the game"
  exit 0
fi

TOKEN=""
if [ -s "$TOKEN_FILE" ]; then TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE"); fi
if [ -z "$TOKEN" ]; then
  if [ "$REQUIRED" = "true" ]; then
    echo "marine-park: v$VERSION is pinned but no marine_park_token secret was given" >&2
    exit 1
  fi
  echo "marine-park: no marine_park_token secret; building without the game (v$VERSION is pinned)"
  exit 0
fi

ASSET="MarinePark-$VERSION-web.zip"
echo "marine-park: fetching $ASSET from $REPO release v$VERSION"

RELEASE_JSON=$(curl -fsS \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases/tags/v$VERSION") || {
  echo "marine-park: couldn't read release v$VERSION of $REPO (missing release, or the token can't read it)" >&2
  exit 1
}

ASSET_URL=$(printf '%s' "$RELEASE_JSON" | jq -r --arg name "$ASSET" '.assets[] | select(.name == $name) | .url')
if [ -z "$ASSET_URL" ]; then
  echo "marine-park: release v$VERSION has no $ASSET" >&2
  exit 1
fi

# The asset URL redirects to storage on another host; curl drops the Authorization header there.
curl -fsSL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/octet-stream" \
  "$ASSET_URL" -o /tmp/marine-park-web.zip

unzip -q /tmp/marine-park-web.zip -d "$OUT"
rm -f /tmp/marine-park-web.zip

if [ ! -f "$OUT/index.html" ]; then
  echo "marine-park: $ASSET has no index.html at its root" >&2
  exit 1
fi
echo "marine-park: installed v$VERSION ($(du -sh "$OUT" | cut -f1))"
