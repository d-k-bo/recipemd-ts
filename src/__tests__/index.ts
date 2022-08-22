import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@jest/globals";
import { InvalidRecipeError, Recipe } from "../index";

const testcasePath = "RecipeMD/testcases";
const testRecipes = fs
  .readdirSync(testcasePath)
  .filter((filename) => filename.endsWith(".md"))
  // .filter((filename) => filename === "ingredients_links.md") // test only one file
  .map((filename) => [
    path.join(testcasePath, filename),
    path.join(testcasePath, filename.replace(/\.md$/, ".json")),
  ])
  .filter(
    ([mdPath, jsonPath]) =>
      mdPath.endsWith(".invalid.md") || fs.existsSync(jsonPath)
  );

test.concurrent.each(testRecipes)("%s", async (mdPath, jsonPath) => {
  const md = (await fs.promises.readFile(mdPath)).toString();

  if (mdPath.endsWith(".invalid.md")) {
    expect(() => Recipe.parse(md)).toThrowError(InvalidRecipeError);
  } else {
    const recipe = Recipe.parse(md);
    const json = (await fs.promises.readFile(jsonPath)).toString();

    // conversion to snake_case keys is only done via toJSON()
    expect(JSON.parse(JSON.stringify(recipe))).toEqual(JSON.parse(json));
  }
});
