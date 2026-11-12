# Aperitif

Classic cocktail specs for people who already know how to make them. No technique lessons: just the spec, method, glass, ice and garnish, plus a note when one helps.

- **Browse and filter** (`index.html`): search, plus filters for base spirit, citrus (lemon / lime / grapefruit / orange / none), family, method, glass, tags and any ingredient (*all of* / *any of*). Filters live in the URL, so a filtered view can be shared or bookmarked, e.g. `?base=gin&citrus=lemon`.
- **Saved recipes**: mark drinks as **Favorites** or **Want to try** on cards or recipe pages, then choose either list above the results. Lists stay in your browser and work with the other filters.
- **My bar** (`?view=bar`): tick the bottles you own and see what you can make now, and what one more bottle would unlock. Bottle suggestions are ranked by how many new drinks they unlock, with expandable recipe lists. Pantry ingredients are assumed on hand by default; enable **Track pantry availability** and uncheck anything you are out of. Missing pantry ingredients block readiness and bottle suggestions. Inventory stays in your browser.
- **Recipe** (`recipe.html?c=<slug>`): the spec with an **ml / oz** toggle (30 ml = 1 oz, oz rounded to the nearest ⅛), plus links to similar drinks. Swipe left for the next recipe or right for the previous one, or use the Previous / Next links. Navigation follows the originating filters and sort order (or My bar group), and stops at either end. Direct recipe links browse all drinks alphabetically.

Built phone-first: the filters open in a bottom drawer on phones and become a sidebar on wide screens. Once a page has loaded, the site works offline through a service worker.

It's a plain static site (HTML, CSS, ES modules). There is no framework and no client build step.

Development and CI use Node.js 26 LTS and Python 3.15. The release lines are
declared in `.nvmrc` and `.python-version`; CI installs the latest patch in each
line. Run `nvm install && nvm use` for Node.js, and `pyenv install -s` or
`uv python install` for Python. The site and data build have no dependencies. Optional browser tests use Playwright as a development dependency.

## Layout

| Path | What it is |
| --- | --- |
| `cocktails/<slug>.toml` | One file per drink: **the source of truth**. |
| `ingredients.toml` | The ingredient vocabulary: ids, display names, categories, spirit group, citrus. |
| `tools/build.py` | Validates everything and writes `data/cocktails.json`. Python 3.15, stdlib only. |
| `images/cocktails/<slug>.webp` | Small serving photos, matched to recipes by slug. |
| `data/cocktails.json` | Generated index the site loads. Committed; never edit by hand. |
| `js/data.js` | Filtering, sorting, "My bar", related drinks (pure functions). |
| `js/cards.js`, `js/preferences.js` | Shared recipe cards and validated browser preferences. |
| `js/units.js` | ml/oz and dash/barspoon formatting. |
| `js/app.js`, `js/recipe.js` | The two pages. |
| `js/saved.js` | Local favorites and want-to-try lists, with shared save controls. |
| `tools/tests/` | `node --test` tests for filters, derivations and formatting. |

## IBA coverage

The collection includes all 102 cocktails on the [official IBA list](https://iba-world.com/cocktails/all-cocktails/) (checked 2026-11-08), plus other classics. Filter by the `IBA` tag to see the current list. Existing URLs are retained for Alexander (Brandy Alexander), Spritz (Aperol Spritz), Hemingway Special (Hemingway Daiquiri), Ramos Fizz (Ramos Gin Fizz), and South Side (Southside).

New entries cite their individual IBA pages in TOML comments. Recipe notes identify ingredient substitutions and service details. Tom Collins remains alongside the official John Collins as an Old Tom gin variant.

## Cocktail revival

Filter by `modern classic` for drinks such as Paper Plane, Naked and Famous, Penicillin, Final Ward, Division Bell, and Oaxaca Old Fashioned. The `revived classic` tag identifies Last Word, an older recipe that returned to prominence during the cocktail revival. New recipes cite their source in TOML comments and use the source proportions, with ounce volumes converted at 30 ml per ounce. Notes identify adaptations such as the Gin-Gin Mule’s commercial ginger beer spec.

## Adding a cocktail

1. Create `cocktails/<slug>.toml`. The filename is the URL slug, in lowercase-kebab form:

   ```toml
   name = "Daiquiri"
   family = "sour"
   method = "shake"
   glass = "coupe"
   ice = "none"
   garnish = "lime wheel"          # optional
   tags = ["IBA", "Cuban"]         # optional
   notes = "One short line."       # optional
   # base = ["rum"]                # optional; normally derived

   [[ingredients]]
   id = "white-rum"
   amount = 60
   unit = "ml"

   [[ingredients]]
   id = "lime-juice"
   amount = 22.5
   unit = "ml"
   note = "freshly squeezed"       # optional, shown after the name
   ```

2. If an ingredient isn't in `ingredients.toml` yet, add it there. Reuse existing ids wherever possible; filtering depends on "lime juice" being a single ingredient.
3. Add the serving photo as `images/cocktails/<slug>.webp`. Follow the [cocktail photo guide](.agents/skills/add-cocktail/SKILL.md).
4. Run `python3 tools/build.py` and commit the photo, TOML file and `data/cocktails.json`.

The allowed values for `family`, `method`, `glass`, `ice` and `unit` are listed in `VOCAB` at the top of `tools/build.py`. The build names the file and field of any mistake.

**Derived fields:**
- `base`: the spirit groups among the ml-measured spirits, by volume. A second spirit counts only if it makes up at least half the volume of the main one.
- `citrus`: every citrus the ingredients bring.

**Units:** `ml`, `dash`, `drop`, `barspoon`, `tsp`, `pinch`, `piece` (½ lime, 1 egg white), `leaf`, `rinse`, `top`. Store volumes in ml. Classic ounce specs convert as ¾ oz = 22.5 ml, ½ oz = 15 ml, ¼ oz = 7.5 ml.

## Commands

```sh
python3 tools/build.py              # validate + regenerate data/cocktails.json
python3 tools/build.py --check      # validate + fail if the JSON is stale (CI)
node --test tools/tests/*.test.js   # tests
python3 -m http.server 8000         # preview at http://localhost:8000
```

The service worker doesn't register on `localhost`, so a preview always shows fresh files.

### Browser regression tests

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

The suite starts its own local server under `/aperitif/` to exercise GitHub Pages
subpaths. It tests the 360 px mobile layout, filters, drawer focus, swipe navigation,
history, units, My bar (including beer), malformed or blocked storage, and cold
offline navigation. Each test uses an isolated browser context. Touch tests dispatch
browser touch events to the page's DOM listeners; physical device gesture arbitration
still benefits from a manual phone check. To use an existing Chromium installation,
set `CHROMIUM_PATH=/path/to/chromium`. On a Linux host missing browser libraries,
use Playwright's documented `install --with-deps chromium` setup.

Browser tests are separate from the dependency-free `npm run check` command and
are not added to the deployment workflow.

## Deploying

On every push to `main`, `.github/workflows/pages.yml` validates the data, runs the tests and publishes to GitHub Pages without `tools/` or the TOML sources. In the repository settings, set **Pages → Source** to **GitHub Actions**.
