#!/usr/bin/env bash
# Assemble the GitHub Pages artifact without sources, tools, or package metadata.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

rm -rf _site
mkdir -p _site
rsync -a ./ _site/ \
  --exclude .git --exclude .github --exclude /.agents --exclude _site --exclude __pycache__ \
  --exclude /tools --exclude /cocktails --exclude /ingredients.toml \
  --exclude /node_modules --exclude /package-lock.json --exclude /package.json \
  --exclude /.nvmrc --exclude /.python-version --exclude '/*.md'

version="${GITHUB_SHA:-dev}"
version="${version:0:12}"
sed -i "s/^const VERSION = .*/const VERSION = \"${version}\";/" _site/sw.js
grep -q "^const VERSION = \"${version}\";" _site/sw.js
