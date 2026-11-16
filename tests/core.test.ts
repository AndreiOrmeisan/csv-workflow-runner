import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, exportCsv } from "../src/lib/csv";
import { mergeDatasets, transform } from "../src/lib/transform";
import { readRecipes, writeRecipes, validateRecipe } from "../src/lib/recipes";
import { defaultConfig } from "../src/lib/types";

test("quoted delimiters and escaped quotes", () => {
  assert.deepEqual(parseCsv('name,note\nAda,"Hello, ""friend"""').rows, [
    ["Ada", 'Hello, "friend"'],
  ]);
});
test("multiline fields", () => {
  assert.deepEqual(parseCsv('name,note\nAda,"line one\nline two"').rows, [
    ["Ada", "line one\nline two"],
  ]);
});
test("semicolon and tab detection", () => {
  for (const delimiter of [";", "\t"])
    assert.deepEqual(parseCsv(`a${delimiter}b\n001${delimiter}02`).rows, [
      ["001", "02"],
    ]);
});
test("BOM import and export round trip", () => {
  const data = parseCsv('\uFEFFname,note\n001,"a; b\n""yes"""');
  const output = exportCsv(data, ";");
  assert.equal(output.charCodeAt(0), 0xfeff);
  assert.deepEqual(parseCsv(output).rows, data.rows);
  assert.deepEqual(parseCsv(output).columns, data.columns);
});
test("duplicates use all columns and preserve input", () => {
  const source = parseCsv("a,b\nx,y\nx,y\nx,z");
  const before = JSON.stringify(source);
  assert.deepEqual(
    transform(source, { ...defaultConfig, deduplicate: true }).rows,
    [
      ["x", "y"],
      ["x", "z"],
    ],
  );
  assert.equal(JSON.stringify(source), before);
});
test("different column orders and missing columns", () => {
  assert.deepEqual(
    mergeDatasets([parseCsv("a,b\n1,2"), parseCsv("b,a,c\n3,4,5")]),
    {
      columns: ["a", "b", "c"],
      rows: [
        ["1", "2", ""],
        ["4", "3", "5"],
      ],
    },
  );
});
test("trim, empty rows and deduplication run in order", () => {
  assert.deepEqual(
    transform(parseCsv("a,b\n x , y \nx,y\n , "), {
      ...defaultConfig,
      trim: true,
      removeEmpty: true,
      deduplicate: true,
    }).rows,
    [["x", "y"]],
  );
});
test("empty rows and whitespace survive unless selected", () => {
  const data = parseCsv("a,b\n,\n , \n");
  assert.deepEqual(transform(data, defaultConfig).rows, [
    ["", ""],
    [" ", " "],
  ]);
  assert.equal(
    transform(data, { ...defaultConfig, removeEmpty: true }).rows.length,
    1,
  );
});
test("malformed quoting, excess cells and ambiguous headers rejected", () => {
  for (const source of [
    'a,b\n"unterminated,x',
    "a,b\n1,2,3",
    "a,a\n1,2",
    ",b\n1,2",
    "",
  ])
    assert.throws(() => parseCsv(source));
});
test("short rows get warning and padding", () => {
  const data = parseCsv("a,b\n1");
  assert.deepEqual(data.rows, [["1", ""]]);
  assert.ok(data.warnings.length);
});
test("renames apply by original name and reject collisions", () => {
  const config = { ...defaultConfig, renames: { a: "customer" } };
  assert.deepEqual(transform(parseCsv("b,a\n2,1"), config).columns, [
    "b",
    "customer",
  ]);
  assert.throws(() =>
    transform(parseCsv("a,b\n1,2"), { ...defaultConfig, renames: { a: "b" } }),
  );
});
test("recipes save, validate and contain only configuration", () => {
  let stored = "";
  const storage = {
    getItem: () => stored || null,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
  };
  const recipe = validateRecipe({
    version: 1,
    name: "Monthly",
    config: { ...defaultConfig, trim: true, renames: { a: "Name" } },
  });
  writeRecipes(storage, [recipe]);
  assert.equal(readRecipes(storage)[0].config.renames.a, "Name");
  assert.equal(readRecipes(storage)[0].name, "Monthly");
  assert.throws(() => validateRecipe({ ...recipe, rows: [["secret"]] }));
  assert.throws(() =>
    validateRecipe({ ...recipe, config: { ...recipe.config, trim: "yes" } }),
  );
  assert.throws(() => validateRecipe({ ...recipe, version: 2 }));
  assert.throws(() =>
    validateRecipe({
      ...recipe,
      config: { ...recipe.config, renames: { a: "" } },
    }),
  );
});
test("special column names are handled as text", () => {
  const recipe = validateRecipe(
    JSON.parse(
      '{"version":1,"name":"Safe","config":{"trim":false,"removeEmpty":false,"deduplicate":false,"merge":true,"renames":{"__proto__":"label"}}}',
    ) as unknown,
  );
  assert.deepEqual(
    transform(parseCsv("__proto__,toString\nx,y"), recipe.config).columns,
    ["label", "toString"],
  );
});

test("carriage-return records preserve data and ignore final newline", () => {
  assert.deepEqual(parseCsv("a,b\r1,2\r").rows, [["1", "2"]]);
});

test("merged cell limits are checked before allocating output", () => {
  const columns = Array.from({ length: 500 }, (_, index) => `c${index}`);
  assert.throws(() => mergeDatasets([{ columns, rows: Array.from({ length: 6001 }, () => []) }]), /3 million/);
});
