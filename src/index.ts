/*
  recipemd-ts - TypeScript implementation for the RecipeMD format.

  Copyright (C) 2022 d-k-bo

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Lesser General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Lesser General Public License for more details.

  You should have received a copy of the GNU Lesser General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Data } from "dataclass";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.js";

const UNICODE_FRACTIONS: { [key: string]: number } = {
  // https://unicode-table.com/en/blocks/latin-1-supplement/
  "\u00BC": 1 / 4,
  "\u00BD": 1 / 2,
  "\u00BE": 3 / 4,
  // https://unicode-table.com/en/blocks/number-forms/
  "\u2150": 1 / 7,
  "\u2151": 1 / 9,
  "\u2152": 1 / 10,
  "\u2153": 1 / 3,
  "\u2154": 2 / 3,
  "\u2155": 1 / 5,
  "\u2156": 2 / 5,
  "\u2157": 3 / 5,
  "\u2158": 4 / 5,
  "\u2159": 1 / 6,
  "\u215A": 5 / 6,
  "\u215B": 1 / 8,
  "\u215C": 3 / 8,
  "\u215D": 5 / 8,
  "\u215E": 7 / 8,
};

function camelCaseTo_snake_case(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

class RecipeData extends Data {
  toJSON(): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(this).map(([key, value]) => [
        camelCaseTo_snake_case(key),
        key === "factor" && typeof value == "number" ? value.toString() : value,
      ])
    );
  }
}

export class Recipe extends RecipeData {
  title: string;
  description: string | null = null;
  tags: string[] = [];
  yields: Amount[] = [];
  ingredients: Ingredient[] = [];
  ingredientGroups: IngredientGroup[] = [];
  instructions: string | null = null;

  static parse(this: void, src: string): Recipe {
    const parser = new RecipeParser();

    parser.src = src;
    parser.srcLines = src.split(/\r?\n/);

    parser.blockTokens = parser.mdBlock.parse(src, {});

    const title = parser.parseTitle();
    const description = parser.parseDescription();
    const [tags, yields] = parser.parseTagsAndYields();

    if (parser.blockTokens.length && parser.blockTokens[0].type === "hr")
      parser.blockTokens.shift();
    else {
      throw new InvalidRecipeError(
        `Expected hr before ingredient list, got ${
          parser.blockTokens.shift()?.type
        } instead.`
      );
    }

    const [ingredients, ingredientGroups] = parser.parseIngredients();

    if (parser.blockTokens.length && parser.blockTokens[0].type === "hr")
      parser.blockTokens.shift();
    else if (parser.blockTokens.length) {
      throw new InvalidRecipeError(
        `Expected hr before before instructions, got ${
          parser.blockTokens.shift()?.type
        } instead.`
      );
    }

    const instructions = parser.parseInstructions();

    return Recipe.create({
      title,
      description,
      tags,
      yields,
      ingredients,
      ingredientGroups,
      instructions,
    });
  }
}

export class Amount extends RecipeData {
  factor: number | null = null;
  unit: string | null = null;

  static parse(this: void, amountString: string): Amount {
    amountString = amountString.trim();
    for (const [regexp, factorFunction] of RecipeParser.valueFormats) {
      //! negative amounts arent supported
      const match = amountString.match(regexp);
      if (match) {
        const factor = factorFunction(match);
        const unit = match.groups!.unit?.trim();
        return Amount.create({ factor: factor, unit: unit ?? null });
      }
    }
    const unit = amountString.trim();
    return Amount.create({ factor: null, unit });
  }
}

export class Ingredient extends RecipeData {
  name: string;
  amount: Amount | null = null;
  link: string | null = null;
}

export class IngredientGroup extends RecipeData {
  title: string | null = null;
  ingredients: Ingredient[] = [];
  ingredientGroups: IngredientGroup[] = [];
}

export class InvalidRecipeError extends Error {}
export class RecipeParserError extends Error {}

class RecipeParser {
  listSplitRegExp = /(?<!\d),|,(?!\d)/;
  static valueFormats: [RegExp, (match: RegExpMatchArray) => number][] = [
    // improper fraction (1 1/2)
    [
      /^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(?<unit>.*)?$/,
      (match) => parseInt(match[1]) + parseInt(match[2]) / parseInt(match[3]),
    ],
    // improper fraction with unicode vulgar fraction (1 ½)
    [
      /^(\d+)\s+([\u00BC-\u00BE\u2150-\u215E])\s*(?<unit>.*)?$/,
      (match) => parseInt(match[1]) + UNICODE_FRACTIONS[match[2]],
    ],
    // proper fraction (5/6)
    [
      /^(\d+)\s*\/\s*(\d+)\s*(?<unit>.*)?$/,
      (match) => parseInt(match[1]) / parseInt(match[2]),
    ],
    // proper fraction with unicode vulgar fraction (⅚)
    [
      /^([\u00BC-\u00BE\u2150-\u215E])\s*(?<unit>.*)?$/,
      (match) => UNICODE_FRACTIONS[match[1]],
    ],
    // decimal (5,4 or 5.6)
    [
      /^(\d*)[.,](\d+)\s*(?<unit>.*)?$/,
      (match) => parseFloat(`${match[1]}.${match[2]}`),
    ],
    // integer (4)
    [/^(\d+)\s*(?<unit>.*)?$/, (match) => parseInt(match[1])],
  ];

  mdBlock: MarkdownIt;
  mdEmph: MarkdownIt;
  mdLink: MarkdownIt;
  src: string | null;
  srcLines: string[];
  blockTokens: Token[];

  constructor() {
    const inline_rules = [
      "text",
      "newline",
      "escape",
      "backticks",
      "strikethrough",
      "emphasis",
      "link",
      "image",
      "autolink",
      "html_inline",
      "entity",
    ];
    const inline_rules2 = [
      "balance_pairs",
      "strikethrough",
      "emphasis",
      "fragments_join", // == text_collapse (renamed in markdown-it 13.0.0)
    ];
    this.mdBlock = new MarkdownIt("commonmark");
    this.mdBlock.disable(["reference", ...inline_rules, ...inline_rules2]);
    this.mdEmph = new MarkdownIt("commonmark");
    this.mdEmph.disable(inline_rules);
    this.mdEmph.enable("emphasis");
    this.mdLink = new MarkdownIt("zero");
    // this.mdLink.disable(inline_rules);
    this.mdLink.enable("link");

    this.src = null;
    this.srcLines = [];
    this.blockTokens = [];
  }

  parseTitle(): string {
    const headingOpenToken = this.blockTokens.shift();

    if (headingOpenToken?.type !== "heading_open") {
      throw new InvalidRecipeError(
        `Title (heading_open with level h1) required, got ${headingOpenToken?.type} instead.`
      );
    }
    if (headingOpenToken?.tag !== "h1") {
      throw new InvalidRecipeError(
        `Title (heading_open with level h1) required, got level ${headingOpenToken?.tag} instead.`
      );
    }

    const headingContentToken = this.blockTokens.shift();

    if (headingContentToken === undefined) {
      throw new RecipeParserError(
        "Expected heading content, got undefined instead."
      );
    }

    const headingCloseToken = this.blockTokens.shift();

    if (headingCloseToken?.type !== "heading_close") {
      throw new RecipeParserError(
        `Expected 'heading_close', got ${headingCloseToken?.type} instead.`
      );
    }

    return headingContentToken.content;
  }

  parseDescription(): string | null {
    return this.parseBlocksWhile(
      () =>
        this.blockTokens[0]?.type !== "hr" && this.peekEmphParagraph() === null
    );
  }

  parseTagsAndYields(): [string[], Amount[]] {
    let tags: string[] = [];
    let yields: Amount[] = [];
    let peekedEmphParagraph = this.peekEmphParagraph();
    while (peekedEmphParagraph !== null) {
      const [tokenType, content] = peekedEmphParagraph;
      if (tokenType === "em_open") {
        if (tags.length) {
          throw new InvalidRecipeError(
            "Tags may not be specified multiple times"
          );
        }
        tags = content.split(this.listSplitRegExp).map((tag) => tag.trim());
      } else {
        if (yields.length) {
          throw new InvalidRecipeError(
            "Yields may not be specified multiple times"
          );
        }
        yields = content.split(this.listSplitRegExp).map(Amount.parse);
      }

      this.blockTokens.splice(0, 3); //? this should be equivalent to `del self._block_tokens[:3]`
      peekedEmphParagraph = this.peekEmphParagraph();
    }

    return [tags, yields];
  }

  parseIngredients(): [Ingredient[], IngredientGroup[]] {
    const ingredients: Ingredient[] = [];
    const ingredientGroups: IngredientGroup[] = [];
    while (
      this.blockTokens.length &&
      (this.blockTokens[0].type === "heading_open" ||
        this.blockTokens[0].type === "bullet_list_open" ||
        this.blockTokens[0].type === "ordered_list_open")
    ) {
      if (this.blockTokens[0].type === "heading_open") {
        this.parseIngredientGroups(ingredientGroups, -1);
      } else {
        this.parseIngredientList(ingredients);
      }
    }

    return [ingredients, ingredientGroups];
  }

  parseIngredientGroups(
    ingredientGroups: IngredientGroup[],
    parentLevel: number
  ): void {
    while (
      this.blockTokens.length &&
      this.blockTokens[0].type === "heading_open"
    ) {
      const level = parseInt(this.blockTokens[0].tag[1]);
      if (level <= parentLevel) {
        return;
      }

      this.blockTokens.shift();
      const headingContentToken = this.blockTokens.shift();
      if (headingContentToken === undefined) {
        throw new RecipeParserError(
          "Expected heading_content, got undefined instead."
        );
      }
      if (this.blockTokens.shift() === undefined) {
        throw new RecipeParserError(
          "Expected heading_close, got undefined instead."
        );
      }

      const group = IngredientGroup.create({
        title: headingContentToken.content,
      });
      if (
        this.blockTokens.length &&
        // @ts-ignore: TS does invalid type inference here
        (this.blockTokens[0].type === "bullet_list_open" ||
          // @ts-ignore: TS does invalid type inference here
          this.blockTokens[0].type === "ordered_list_open")
      ) {
        this.parseIngredientList(group.ingredients);
      }

      ingredientGroups.push(group);

      this.parseIngredientGroups(group.ingredientGroups, level);
    }
  }

  parseIngredientList(ingredients: Ingredient[]): void {
    while (
      this.blockTokens.length &&
      (this.blockTokens[0].type === "bullet_list_open" ||
        this.blockTokens[0].type === "ordered_list_open")
    ) {
      const listOpen = this.blockTokens.shift()!;

      const listCloseIndex = RecipeParser.getCloseIndex(
        listOpen,
        this.blockTokens
      );
      const listClose = this.blockTokens[listCloseIndex];
      // @ts-ignore: TS does invalid type inference here
      while (this.blockTokens[0].type === "list_item_open") {
        ingredients.push(this.parseIngredient());
      }
      if (this.blockTokens.shift() !== listClose) {
        throw new RecipeParserError(
          "Somehing went wrong while parsing ingredients. Maybe an of-by-one error happened?"
        );
      }
    }
  }

  parseIngredient(): Ingredient {
    const listItemOpen = this.blockTokens.shift();
    if (listItemOpen?.type !== "list_item_open") {
      throw new RecipeParserError(
        `Expected 'list_item_open', got ${listItemOpen?.type} instead.`
      );
    }

    let continuationStartLine = null;
    let firstParagraphContent = null;
    if (
      this.blockTokens.length &&
      this.blockTokens[0].type === "paragraph_open"
    ) {
      const firstParagraphOpen = this.blockTokens.shift()!;
      firstParagraphContent = this.blockTokens.shift();
      const firstParagraphCloseIndex = RecipeParser.getCloseIndex(
        firstParagraphOpen,
        this.blockTokens
      );
      this.blockTokens.splice(0, firstParagraphCloseIndex + 1); //? this should be equivalent to `del self._block_tokens[: first_paragraph_close_index + 1]`
      if (firstParagraphOpen.map) {
        continuationStartLine = firstParagraphOpen.map[1];
      }
    }

    const endIndex = RecipeParser.getCloseIndex(listItemOpen, this.blockTokens);
    const listItemClose = this.blockTokens[endIndex];

    let amount: string | null;
    let rest: string;
    let name: string;
    let link: string | null;
    if (firstParagraphContent) {
      [amount, rest] = this.parseFirstEmph(firstParagraphContent.content);
      if (endIndex === 0) {
        [link, name] = this.parseWrappingLink(rest);
      } else {
        name = rest;
        link = null;
      }
    } else {
      amount = null;
      name = "";
      link = null;
    }

    const nameContinuation = this.parseBlocksWhile(
      () => this.blockTokens[0] != listItemClose,
      continuationStartLine ?? undefined
    );

    if (nameContinuation) {
      name += "\n" + nameContinuation;
    }

    if (this.blockTokens.shift() !== listItemClose) {
      throw new RecipeParserError(
        "Somehing went wrong while parsing ingredient. Maybe an of-by-one error happened?"
      );
    }

    if (!name) {
      throw new InvalidRecipeError("Missing ingredient name.");
    }
    name = name.trim();

    return Ingredient.create({
      name,
      amount: amount !== null ? Amount.parse(amount) : null,
      link,
    });
  }

  parseInstructions(): string | null {
    return this.parseBlocksWhile(() => true);
  }

  parseBlocksWhile(
    condition: () => boolean,
    startLine?: number
  ): string | null {
    let endLine: number | undefined = undefined;
    while (this.blockTokens.length && condition()) {
      const openToken = this.consumeBlock();
      if (openToken.map === null) {
        throw new RecipeParserError(
          `Can't map openToken to source: ${JSON.stringify(openToken)}`
        );
      }
      startLine = startLine ?? openToken.map[0];
      endLine = openToken.map[1];
    }
    if (startLine === undefined || endLine === undefined) {
      return null;
    }
    return this.srcLines.slice(startLine, endLine).join("\n");
  }

  consumeBlock(): Token {
    const open = this.blockTokens.shift();
    if (open === undefined) {
      throw new RecipeParserError(
        "Expected another block, but there are none left."
      );
    }
    if (open.type.endsWith("_open")) {
      const closeIndex = RecipeParser.getCloseIndex(open, this.blockTokens);
      this.blockTokens.splice(0, closeIndex + 1); //? this should be equivalent to `del self._block_tokens[0 : close_index + 1]`
    }
    return open;
  }

  parseFirstEmph(firstParagraph: string): [string | null, string] {
    const inlineTokens =
      this.mdEmph.parseInline(firstParagraph, {})[0].children ?? [];
    let emphContent: string | null;

    if (inlineTokens.length && inlineTokens[0].type === "em_open") {
      const emphOpenToken = inlineTokens.shift()!;
      const emphCloseIndex = RecipeParser.getCloseIndex(
        emphOpenToken,
        inlineTokens
      );
      const emphContentTokens = inlineTokens.slice(0, emphCloseIndex);
      emphContent = RecipeParser.serializeEmphInlineTokens(emphContentTokens);
      inlineTokens.splice(0, emphCloseIndex + 1); //? this should be equivalent to `del inline_tokens[: emph_close_index + 1]`
    } else {
      emphContent = null;
    }

    const rest = RecipeParser.serializeEmphInlineTokens(inlineTokens);

    return [emphContent, rest];
  }

  parseWrappingLink(firstParagraph: string): [string | null, string] {
    //? is there any purpose for this? `p` is never used `this.mdLink.parseInline` has no side effects
    // let p = this.mdLink.parseInline(firstParagraph, {});
    const inlineTokens =
      this.mdLink.parseInline(firstParagraph, {})[0].children ?? [];

    RecipeParser.consumeWhitespaceTextTokens(inlineTokens);

    if (inlineTokens.length === 0 || inlineTokens[0].type !== "link_open") {
      return [null, firstParagraph];
    }

    const linkOpenToken = inlineTokens.shift()!;
    const linkCloseIndex = RecipeParser.getCloseIndex(
      linkOpenToken,
      inlineTokens
    );
    const linkContentTokens = inlineTokens.slice(0, linkCloseIndex);
    inlineTokens.splice(0, linkCloseIndex + 1); //? this should be equivalent to `del inline_tokens[: link_close_index + 1]`

    RecipeParser.consumeWhitespaceTextTokens(inlineTokens);

    if (inlineTokens.length) {
      return [null, firstParagraph];
    }

    const linkContent = linkContentTokens
      .map((token) => token.content)
      .join("");
    return [linkOpenToken.attrGet("href") ?? "None", linkContent];
  }

  peekEmphParagraph(): ["em_open" | "strong_open", string] | null {
    if (
      this.blockTokens.length < 3 ||
      this.blockTokens[0].type !== "paragraph_open" ||
      this.blockTokens[1].type !== "inline" ||
      this.blockTokens[2].type !== "paragraph_close"
    ) {
      return null;
    }
    const inlineContent = this.blockTokens[1].content;

    const inlineTokens =
      this.mdEmph.parseInline(inlineContent, {})[0]?.children ?? [];

    RecipeParser.consumeEmptyTextTokens(inlineTokens);

    const emphOpenToken = inlineTokens.shift();
    if (
      emphOpenToken?.type !== "em_open" &&
      emphOpenToken?.type !== "strong_open"
    ) {
      return null;
    }

    const emphCloseIndex = RecipeParser.getCloseIndex(
      emphOpenToken,
      inlineTokens
    );
    const emphContentTokens = inlineTokens.slice(0, emphCloseIndex);
    inlineTokens.splice(0, emphCloseIndex + 1); //? this should be equivalent to `del inline_tokens[: emph_close_index + 1]`

    RecipeParser.consumeEmptyTextTokens(inlineTokens);

    if (inlineTokens.length) {
      return null;
    }

    return [
      emphOpenToken.type,
      RecipeParser.serializeEmphInlineTokens(emphContentTokens),
    ];
  }

  static consumeEmptyTextTokens(inlineTokens: Token[]): void {
    while (
      inlineTokens.length &&
      inlineTokens[0].type === "text" &&
      inlineTokens[0].content === ""
    ) {
      inlineTokens.shift();
    }
  }

  static consumeWhitespaceTextTokens(inlineTokens: Token[]): void {
    while (
      inlineTokens.length &&
      inlineTokens[0].type === "text" &&
      inlineTokens[0].content.match(/^\s+$/)
    ) {
      inlineTokens.shift();
    }
  }

  static serializeEmphInlineTokens(emphContentTokens: Token[]): string {
    return emphContentTokens
      .map((token) => token.content || token.markup)
      .join("");
  }

  static getCloseIndex(open: Token, tokens: Token[]): number {
    if (!open.type.endsWith("_open")) {
      throw new RecipeParserError(
        `Expected open token, got ${open.type} instead.`
      );
    }
    const closeType = open.type.replace(/_open$/, "_close");
    for (const [i, token] of tokens.entries()) {
      if (token.type === closeType && token.level === open.level) {
        return i;
      }
    }
    return tokens.length;
  }
}
