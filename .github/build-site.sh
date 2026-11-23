#!/usr/bin/env bash
set -euo pipefail

rsync -a --delete --delete-excluded \
  --include='/index.html' --include='/recipe.html' \
  --include='/manifest.webmanifest' --include='/sw.js' \
  --include='/css/***' --include='/data/***' --include='/icons/***' \
  --include='/images/***' --include='/js/***' --exclude='*' ./ _site/

revision=${GITHUB_SHA:-$(git rev-parse HEAD)}
sed -i "s/^const VERSION = .*/const VERSION = \"${revision:0:12}\";/" _site/sw.js
grep -q "^const VERSION = \"${revision:0:12}\";" _site/sw.js
