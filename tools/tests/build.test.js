import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const buildRecipe = `
import importlib.util
import pathlib
import sys
import tempfile

spec = importlib.util.spec_from_file_location("build", "tools/build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
with tempfile.TemporaryDirectory() as directory:
    build.COCKTAILS = pathlib.Path(directory)
    build.OUT = build.COCKTAILS / "cocktails.json"
    source = (build.ROOT / "cocktails/daiquiri.toml").read_text()
    (build.COCKTAILS / "daiquiri.toml").write_text(source.replace("amount = 60", "amount = " + sys.argv[1]))
    build.main()
    print(build.OUT.read_text())
`;

for (const amount of ["nan", "inf", "-inf", "0", "-1", "true"]) {
  test(`build rejects amount = ${amount} with a recipe diagnostic`, () => {
    const result = spawnSync("python3", ["-c", buildRecipe, amount], {
      cwd: root, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /cocktails\/daiquiri.toml ingredient 1: amount must be a finite positive number/);
    assert.doesNotMatch(result.stderr, /Traceback/);
  });
}

test("build still serializes finite fractional amounts as valid JSON", () => {
  const result = spawnSync("python3", ["-c", buildRecipe, "22.5"], {
    cwd: root, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout.slice(result.stdout.indexOf('{"vocab":')));
  assert.equal(data.cocktails[0].ingredients[0].amount, 22.5);
});

// Swaps one line of the Daiquiri for argv[2] and builds.
const editRecipe = buildRecipe.replace(
  'source.replace("amount = 60", "amount = " + sys.argv[1])',
  "source.replace(sys.argv[1], sys.argv[2])",
);
const cases = [
  ['name = "Daiquiri"', "name = 3", /name must be a non-empty string/],
  ['garnish = "lime wheel"', 'garnish = ["lime"]', /garnish must be a non-empty string/],
  ['tags = ["IBA", "Cuban"]', 'tags = ["IBA", 1]', /tags must be a list of non-empty strings/],
  ['family = "sour"', 'family = ["sour"]', /family \['sour'\] not in/],
  ['tags = ["IBA", "Cuban"]', 'base = ["none", "rum"]', /base 'none' can't be combined/],
  ['tags = ["IBA", "Cuban"]', 'base = "rum"', /base must be a list/],
  ['id = "white-rum"', 'id = ["white-rum"]', /unknown ingredient id/],
  ['unit = "ml"', 'unit = { a = 1 }', /unit .* not in/],
];
for (const [from, to, message] of cases) {
  test(`build rejects ${to} with a recipe diagnostic`, () => {
    assert.notEqual(editRecipe, buildRecipe);
    const result = spawnSync("python3", ["-c", editRecipe, from, to], {
      cwd: root, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /Traceback/);
  });
}
