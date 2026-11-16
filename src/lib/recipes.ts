import type { Recipe } from "./types";
export const RECIPE_KEY = "csv-workflow-recipes-v1";
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validateRecipe(value: unknown): Recipe {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80 ||
    !record(value.config)
  )
    throw new Error(
      "Invalid recipe. Expected a version 1 recipe with a name and configuration.",
    );
  if (
    Object.keys(value).some(
      (key) => !["version", "name", "config"].includes(key),
    )
  )
    throw new Error("Recipes may contain configuration only.");
  const config = value.config;
  if (
    Object.keys(config).some(
      (key) =>
        !["trim", "removeEmpty", "deduplicate", "merge", "renames"].includes(
          key,
        ),
    ) ||
    [config.trim, config.removeEmpty, config.deduplicate, config.merge].some(
      (flag) => typeof flag !== "boolean",
    ) ||
    !record(config.renames)
  )
    throw new Error("Recipe transformation settings are invalid.");
  const renames: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  if (Object.keys(config.renames).length > 500)
    throw new Error("Too many column renames.");
  for (const [key, name] of Object.entries(config.renames)) {
    if (
      !key ||
      key.length > 1000 ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 1000
    )
      throw new Error("Recipe column names are invalid.");
    renames[key] = name;
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > 100000)
    throw new Error("Recipe configuration must be under 100 KB.");
  return {
    version: 1,
    name: value.name.trim(),
    config: {
      trim: config.trim as boolean,
      removeEmpty: config.removeEmpty as boolean,
      deduplicate: config.deduplicate as boolean,
      merge: config.merge as boolean,
      renames,
    },
  };
}
export function readRecipes(storage: Pick<Storage, "getItem">): Recipe[] {
  const value: unknown = JSON.parse(storage.getItem(RECIPE_KEY) ?? "[]");
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("Saved recipe storage is invalid.");
  return value.map(validateRecipe);
}
export function writeRecipes(
  storage: Pick<Storage, "setItem">,
  recipes: Recipe[],
): void {
  if (recipes.length > 100)
    throw new Error("You can save up to 100 recipes. Delete one to make room.");
  storage.setItem(RECIPE_KEY, JSON.stringify(recipes.map(validateRecipe)));
}
