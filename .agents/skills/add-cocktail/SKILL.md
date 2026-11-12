---
name: add-cocktail
description: Add or update Aperitif cocktail recipes and their small serving photographs. Use when adding a drink, filling a photo gap, or changing a recipe's glassware, ice, or garnish.
---

# Add a cocktail to Aperitif

1. Read `AGENTS.md` and the recipe format in `README.md`. Use `cocktails/<slug>.toml` as the source of truth. Reuse ingredient IDs, cite the recipe source in a TOML comment, and keep an existing slug stable.
2. Use the recipe's glass, serving ice, garnish, and ingredients to brief a photorealistic square image. Use an existing photo in `images/cocktails/` as a style reference. Frame one complete glass against a warm charcoal bar with soft side lighting. Keep the rim, garnish, and base visible with room around the glass. Use the recipe's color, opacity, and foam. Pick one listed garnish when the spec offers a choice. Omit garnishes that are absent, optional, or expressed and discarded.
3. Review the image at thumbnail size and confirm the glass shape, serving ice, and garnish against the TOML. Use a centered square WebP around 256 × 256 pixels, generally under 25 KB. Save it as `images/cocktails/<slug>.webp`. A recipe can render without a photo while a matching image is pending.
4. Run `python3 tools/build.py` to pick up the photo and regenerate the index. Run `npm run check`, then check the card and `recipe.html?c=<slug>` at phone width. Commit the image and generated JSON alongside any recipe changes when asked.
