# Aperitif

Classic cocktail specs for people who already know how to make them. No technique lessons: just the spec, method, glass, ice and garnish, plus a note when one helps.

- **Browse and filter** (`index.html`): search, plus filters for base spirit, citrus (lemon / lime / grapefruit / orange / none), family, method, glass, tags and any ingredient (*all of* / *any of*). Filters live in the URL, so a filtered view can be shared or bookmarked, e.g. `?base=gin&citrus=lemon`.
- **My bar** (`?view=bar`): tick the bottles you own and see what you can make now, and what one more bottle would unlock. Citrus, juices, syrups, eggs, cream and mixers are assumed on hand. The bottle list stays in your browser.
- **Recipe** (`recipe.html?c=<slug>`): the spec with an **ml / oz** toggle (30 ml = 1 oz, oz rounded to the nearest ⅛), plus links to similar drinks.

Built phone-first: the filters open in a bottom drawer on phones and become a sidebar on wide screens. Once a page has loaded, the site works offline through a service worker.

It's a plain static site (HTML, CSS, ES modules). There is no framework and no client build step.

Development and CI use Node.js 26 LTS and Python 3.15. The release lines are
declared in `.nvmrc` and `.python-version`; CI installs the latest patch in each
line. Run `nvm install && nvm use` for Node.js, and `pyenv install -s` or
`uv python install` for Python. There are no npm or pip dependencies to install.

## Layout

| Path | What it is |
| --- | --- |
| `cocktails/<slug>.toml` | One file per drink: **the source of truth**. |
| `ingredients.toml` | The ingredient vocabulary: ids, display names, categories, spirit group, citrus. |
| `tools/build.py` | Validates everything and writes `data/cocktails.json`. Python 3.15, stdlib only. |
| `data/cocktails.json` | Generated index the site loads. Committed; never edit by hand. |
| `js/data.js` | Filtering, sorting, "My bar", related drinks (pure functions). |
| `js/units.js` | ml/oz and dash/barspoon formatting. |
| `js/app.js`, `js/recipe.js` | The two pages. |
| `tools/tests/` | `node --test` tests for filters, derivations and formatting. |

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
3. Run `python3 tools/build.py` and commit both the TOML file and `data/cocktails.json`.

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

## Deploying

On every push to `main`, `.github/workflows/pages.yml` validates the data, runs the tests and publishes to GitHub Pages without `tools/` or the TOML sources. In the repository settings, set **Pages → Source** to **GitHub Actions**.
