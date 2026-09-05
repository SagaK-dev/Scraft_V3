import type { ItemStack } from '../items/ItemStack.ts';

export interface CraftingRecipe {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly pattern: readonly (number | null)[];
  readonly output: Readonly<ItemStack>;
  readonly allowMirror: boolean;
}

export interface RecipeMatch {
  readonly recipe: CraftingRecipe;
  readonly consumedSlots: readonly number[];
}

export function validateRecipe(recipe: CraftingRecipe): void {
  if (recipe.id.trim().length === 0) throw new TypeError('Recipe id must not be empty.');
  if (!Number.isInteger(recipe.width) || !Number.isInteger(recipe.height) || recipe.width < 1 || recipe.height < 1 || recipe.width > 3 || recipe.height > 3) {
    throw new RangeError('Recipe dimensions must be from 1x1 to 3x3.');
  }
  if (recipe.pattern.length !== recipe.width * recipe.height) throw new RangeError('Recipe pattern size does not match dimensions.');
  if (!recipe.pattern.some(itemId => itemId !== null)) throw new RangeError('Recipe must contain at least one ingredient.');
}
