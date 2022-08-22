# recimemd-ts

A library for parsing recipes written in markdown that follows the [RecipeMD](https://recipemd.org) specification.

This is a TypeScript port of the [Python reference implementation](https://recipemd.org/reference_implementation.html), which is licensed under the terms of the GNU Lesser General Public License v3.0 or later.

It uses [markdown-it](https://github.com/markdown-it/markdown-it) as the markdown parser, which is similar to the library used in Python.

## Features

- [x] parsing recipes from markdown strings
- [x] exporting recipes as JSON
- [ ] parsing recipes from JSON
- [ ] ~~search functionality~~ (not planned)
- [ ] ~~Command-line interface~~ (not planned, use the reference implementation instead)

## Installation

This library can be installed with npm:

```
npm install recipemd
```

## Usage

A `Recipe` object can be created by passing a markdown string to `Recipe.parse()`.

See this [example](examples/water.js):

```js
import { Recipe } from "recipemd";

let markdown = `
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

let recipe = Recipe.parse(markdown);

console.log(recipe);
```

which results in

```ruby (this is what looks best)
Recipe {
  description: 'A refreshing drink that should be consumed several times a day.',
  tags: [ 'drink', 'non-alcoholic', 'H2O' ],
  yields: [ Amount { factor: 1, unit: 'glass' } ],
  ingredients: [
    Ingredient { amount: [Amount], link: null, name: 'glass' },
    Ingredient { amount: [Amount], link: null, name: 'faucet' }
  ],
  ingredientGroups: [],
  instructions: 'Turn on the faucet and fill the glass.',
  title: 'Water'
}
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please run `npm run format`, `npm run lint`, `npm run build` and `npm test` to ensure code quality. The tests use the reference test cases, so make sure to clone the repository with `git clone --recurse-submodules`.

## License

This project is licensed under the GNU Lesser General Public License version 3 or (at your option) any later version (LGPL-3.0-or-later). See [COPYING.LESSER](COPYING.LESSER) for details.
