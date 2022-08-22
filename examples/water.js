import { Recipe } from "recipemd";

const markdown = `
# Water

A refreshing drink that should be consumed several times a day.

*drink, non-alcoholic, H2O*

**1 glass**

---

- *1* glass
- *1* faucet

---

Turn on the faucet and fill the glass.
`;

const recipe = Recipe.parse(markdown);

console.log(recipe);
