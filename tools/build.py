#!/usr/bin/env python3
"""Validate cocktails/*.toml against ingredients.toml and build data/cocktails.json.

    python3 tools/build.py           # validate, then write data/cocktails.json
    python3 tools/build.py --check   # validate, and fail if the JSON is stale

Standard library only (Python 3.11+ for tomllib).
"""
import json
import math
import pathlib
import re
import sys
import tomllib

ROOT = pathlib.Path(__file__).resolve().parent.parent
COCKTAILS = ROOT / "cocktails"
INGREDIENTS = ROOT / "ingredients.toml"
OUT = ROOT / "data" / "cocktails.json"

# Controlled vocabularies: id -> display label. The site reads these from the
# JSON, so this is the only place a label is defined.
VOCAB = {
    "spirit": {
        "gin": "Gin", "whiskey": "Whiskey", "rum": "Rum", "agave": "Agave",
        "brandy": "Brandy", "vodka": "Vodka", "none": "No base spirit",
    },
    "citrus": {
        "lemon": "Lemon", "lime": "Lime", "grapefruit": "Grapefruit",
        "orange": "Orange", "none": "No citrus",
    },
    "family": {
        "spirit-forward": "Spirit-forward", "sour": "Sour",
        "highball": "Highball", "fizz-collins": "Fizz & Collins",
        "julep-smash": "Julep & Smash", "tiki": "Tiki",
        "sparkling": "Sparkling", "dessert": "Dessert", "savory": "Savory",
        "hot": "Hot",
    },
    "method": {
        "stir": "Stir", "shake": "Shake", "build": "Build",
        "swizzle": "Swizzle", "blend": "Blend", "roll": "Roll",
        "throw": "Throw",
    },
    "glass": {
        "coupe": "Coupe", "nick-and-nora": "Nick & Nora", "martini": "Martini",
        "rocks": "Rocks", "highball": "Highball", "collins": "Collins",
        "flute": "Flute", "wine": "Wine glass", "julep-cup": "Julep cup",
        "copper-mug": "Copper mug", "tiki-mug": "Tiki mug",
        "irish-coffee": "Irish coffee glass",
    },
    "ice": {
        "none": "Up, no ice", "cubes": "Cubed ice", "large-cube": "Large cube",
        "crushed": "Crushed ice",
    },
    "unit": {
        "ml": "ml", "dash": "dash", "drop": "drop", "barspoon": "barspoon",
        "tsp": "tsp", "pinch": "pinch", "piece": "", "leaf": "leaf",
        "rinse": "rinse", "top": "top",
    },
    "category": {
        "spirit": "Spirits", "liqueur": "Liqueurs & amari",
        "fortified-wine": "Vermouth & aromatised wine", "wine": "Wine",
        "bitters": "Bitters", "citrus": "Citrus", "juice": "Juice & coffee",
        "sweetener": "Sweeteners", "dairy-egg": "Dairy & egg",
        "mixer": "Mixers", "other": "Other",
    },
}

REQUIRED = ("name", "family", "method", "glass", "ice", "ingredients")
OPTIONAL = ("garnish", "tags", "notes", "base")
ING_KEYS = {"id", "amount", "unit", "note"}
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# A secondary spirit counts as a base when it is at least this share of the main one.
BASE_SHARE = 0.5


def load_ingredients(errors):
    data = tomllib.loads(INGREDIENTS.read_text(encoding="utf-8"))
    for iid, ing in data.items():
        where = f"ingredients.toml [{iid}]"
        if not SLUG.match(iid):
            errors.append(f"{where}: id must be lowercase-kebab")
        if not isinstance(ing.get("name"), str) or not ing["name"]:
            errors.append(f"{where}: missing name")
        if ing.get("category") not in VOCAB["category"]:
            errors.append(f"{where}: category {ing.get('category')!r} not in {sorted(VOCAB['category'])}")
        if "spirit" in ing and (ing["spirit"] not in VOCAB["spirit"] or ing["spirit"] == "none"):
            errors.append(f"{where}: spirit {ing['spirit']!r} is not a base-spirit group")
        if "citrus" in ing and (ing["citrus"] not in VOCAB["citrus"] or ing["citrus"] == "none"):
            errors.append(f"{where}: citrus {ing['citrus']!r} is not a citrus")
        extra = set(ing) - {"name", "category", "spirit", "citrus"}
        if extra:
            errors.append(f"{where}: unknown keys {sorted(extra)}")
    return data


def derive_base(ingredients, vocab_ings):
    volume = {}
    for ing in ingredients:
        group = vocab_ings[ing["id"]].get("spirit")
        if group and ing["unit"] == "ml":
            volume[group] = volume.get(group, 0) + ing["amount"]
    if not volume:
        return ["none"]
    top = max(volume.values())
    # dict keeps first-seen order, so sorted() breaks ties by recipe order
    return [g for g, v in sorted(volume.items(), key=lambda kv: -kv[1]) if v >= top * BASE_SHARE]


def derive_citrus(ingredients, vocab_ings):
    seen = []
    for ing in ingredients:
        c = vocab_ings[ing["id"]].get("citrus")
        if c and c not in seen:
            seen.append(c)
    return seen


def load_cocktail(path, vocab_ings, errors):
    where = f"cocktails/{path.name}"
    slug = path.stem
    if not SLUG.match(slug):
        errors.append(f"{where}: filename must be lowercase-kebab")
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as e:
        errors.append(f"{where}: {e}")
        return None

    n_before = len(errors)
    for key in REQUIRED:
        if key not in raw:
            errors.append(f"{where}: missing {key!r}")
    extra = set(raw) - set(REQUIRED) - set(OPTIONAL)
    if extra:
        errors.append(f"{where}: unknown keys {sorted(extra)}")
    for key in ("family", "method", "glass", "ice"):
        if key in raw and raw[key] not in VOCAB[key]:
            errors.append(f"{where}: {key} {raw[key]!r} not in {sorted(VOCAB[key])}")
    if not isinstance(raw.get("tags", []), list):
        errors.append(f"{where}: tags must be a list")
    for g in raw.get("base", []):
        if g not in VOCAB["spirit"]:
            errors.append(f"{where}: base {g!r} not in {sorted(VOCAB['spirit'])}")

    ingredients = raw.get("ingredients", [])
    if not ingredients:
        errors.append(f"{where}: needs at least one [[ingredients]]")
    for i, ing in enumerate(ingredients, 1):
        iw = f"{where} ingredient {i}"
        extra = set(ing) - ING_KEYS
        if extra:
            errors.append(f"{iw}: unknown keys {sorted(extra)}")
        if ing.get("id") not in vocab_ings:
            errors.append(f"{iw}: unknown ingredient id {ing.get('id')!r} (add it to ingredients.toml)")
        if ing.get("unit") not in VOCAB["unit"]:
            errors.append(f"{iw}: unit {ing.get('unit')!r} not in {sorted(VOCAB['unit'])}")
        amount = ing.get("amount")
        if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount <= 0:
            errors.append(f"{iw}: amount must be a finite positive number")
    if len(errors) > n_before:
        return None

    ings = [{k: ing[k] for k in ("id", "amount", "unit", "note") if k in ing} for ing in ingredients]
    out = {
        "slug": slug,
        "name": raw["name"],
        "family": raw["family"],
        "method": raw["method"],
        "glass": raw["glass"],
        "ice": raw["ice"],
        "base": raw.get("base") or derive_base(ings, vocab_ings),
        "citrus": derive_citrus(ings, vocab_ings),
        "ingredients": ings,
    }
    for key in ("garnish", "notes"):
        if raw.get(key):
            out[key] = raw[key]
    out["tags"] = raw.get("tags", [])
    return out


def build():
    errors = []
    vocab_ings = load_ingredients(errors)
    cocktails = []
    for path in sorted(COCKTAILS.glob("*.toml")):
        c = load_cocktail(path, vocab_ings, errors)
        if c:
            cocktails.append(c)

    names = {}
    for c in cocktails:
        key = c["name"].casefold()
        if key in names:
            errors.append(f"duplicate name {c['name']!r}: {names[key]} and {c['slug']}")
        names[key] = c["slug"]

    used = {i["id"] for c in cocktails for i in c["ingredients"]}
    unused = sorted(set(vocab_ings) - used)

    cocktails.sort(key=lambda c: c["name"].casefold())
    # Invalid recipes are reported below; never serialize their nonfinite amounts.
    if errors:
        return errors, "", len(cocktails), unused
    dump = lambda o: json.dumps(o, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    # One cocktail per line keeps git diffs readable.
    text = (
        '{"vocab":' + dump(VOCAB) + ",\n"
        '"ingredients":' + dump(vocab_ings) + ",\n"
        '"cocktails":[\n' + ",\n".join(dump(c) for c in cocktails) + "\n]}\n"
    )
    return errors, text, len(cocktails), unused


def main():
    check = "--check" in sys.argv[1:]
    errors, text, n, unused = build()
    if errors:
        print(f"{len(errors)} error(s):", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        sys.exit(1)
    if unused:
        print(f"note: unused ingredients: {', '.join(unused)}")
    if check:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != text:
            print("data/cocktails.json is out of date: run python3 tools/build.py and commit it.", file=sys.stderr)
            sys.exit(1)
        print(f"ok: {n} cocktails, data/cocktails.json is up to date")
    else:
        OUT.parent.mkdir(exist_ok=True)
        OUT.write_text(text, encoding="utf-8")
        print(f"wrote data/cocktails.json ({n} cocktails, {len(text) // 1024} KB)")


if __name__ == "__main__":
    main()
