import { ItemIds } from '../items/ItemRegistry.ts';

export interface FurnaceRecipe {
  readonly inputItemId: number;
  readonly outputItemId: number;
  readonly cookTime: number;
}

const RECIPES = new Map<number, FurnaceRecipe>([
  [ItemIds.SAND, { inputItemId: ItemIds.SAND, outputItemId: ItemIds.GLASS, cookTime: 8 }],
]);

const FUELS = new Map<number, number>([
  [ItemIds.WOOD, 15],
  [ItemIds.PLANKS, 5],
  [ItemIds.STICK, 2.5],
]);

export function furnaceRecipeFor(itemId: number): FurnaceRecipe | null {
  return RECIPES.get(itemId) ?? null;
}

export function fuelSecondsFor(itemId: number): number {
  return FUELS.get(itemId) ?? 0;
}
