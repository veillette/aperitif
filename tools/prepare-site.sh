#!/usr/bin/env bash
# Assemble the GitHub Pages artifact: only the public site files, stamped SW.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

rsync -a --delete --delete-excluded \
  --include='/index.html' --include='/recipe.html' \
  --include='/manifest.webmanifest' --include='/sw.js' \
  --include='/css/***' --include='/data/***' --include='/icons/***' \
  --include='/images/***' --include='/js/***' --exclude='*' ./ _site/

revision="${GITHUB_SHA:-$(git rev-parse HEAD)}"
revision="${revision:0:12}"
sed -i "s/^const VERSION = .*/const VERSION = \"${revision}\";/" _site/sw.js
grep -q "^const VERSION = \"${revision}\";" _site/sw.js
