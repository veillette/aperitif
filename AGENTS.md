# AGENTS.md — aperitif

A static cocktail-recipe site for GitHub Pages. See `README.md` for the layout and the recipe format.

## Rules

- **Recipes live in `cocktails/*.toml`, and ingredients live in `ingredients.toml`.** `data/cocktails.json` is generated: never edit it by hand. Run `python3 tools/build.py` after any data change and commit the JSON alongside the TOML.
- Before adding a new ingredient id, reuse an existing one. Add a new id only for a genuinely different product, such as `old-tom-gin` vs `london-dry-gin`. Give citrus-bearing items a `citrus` key.
- Enum values (family, method, glass, ice, unit, category, spirit groups) and their display labels are defined once, in `VOCAB` in `tools/build.py`. The site reads them from the JSON, so do not duplicate labels in JS.
- The audience already knows bar technique. Keep `notes` to one or two short sentences, and only for what isn't obvious (a spec choice, the original version, a service detail). Don't explain shaking vs stirring.
- Volumes are stored in ml (¾ oz = 22.5 ml). Prefer classic or IBA specs and say so in a note when deviating.
- Phone first: keep tap targets ≥ 44 px, inputs at ≥ 16 px font, and no horizontal scroll at 360 px. The filter UI is a drawer below 1024 px and a sidebar at 1024 px and up.
- No framework, bundler or runtime dependencies. Build-time tooling is stdlib Python. Tests use `node --test`.
- Build DOM with `h()` from `js/dom.js` (text only, no `innerHTML`). Wrap all
  localStorage access in `store` from `js/storage.js`.
- **`js/storage.js` is the fleet-canonical browser storage helper.** Edit it
  here, then from the Origami checkout run
  `node tools/sync-site-helpers.mjs --write` so A-Table, origami, sketchbook,
  and ukulele-first-strum receive the copy. Do not fork a second `store`
  helper in those repos.
- Assemble the Pages artifact only with `npm run prepare:site`
  (`tools/prepare-site.sh`). There is no second build-site script.

When adding a cocktail or its photo, follow [Add Cocktail](.agents/skills/add-cocktail/SKILL.md).

## Verify

```sh
npm run check
npm run prepare:site
node .github/site-smoke.mjs _site --assets-only
```

After installing Playwright Chromium (`npx playwright install --only-shell chromium`),
run `npm run test:browser`. Shared Pages CI and smoke helpers come from Origami;
edit them there and sync with `node tools/sync-site-helpers.mjs --write`.

Branch: `main`. Commit or push only when asked.
