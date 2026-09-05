import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { cloneStack, type ItemStack } from '../items/ItemStack.ts';
import type { PlayerInventory } from '../inventory/PlayerInventory.ts';
import type { CraftingGrid } from './CraftingGrid.ts';
import type { CraftingRegistry } from './CraftingRegistry.ts';

export interface CraftResult {
  readonly crafted: boolean;
  readonly output: ItemStack | null;
}

export function previewCraft(grid: CraftingGrid, recipes: CraftingRegistry): ItemStack | null {
  const match = recipes.findMatch(grid);
  return match ? cloneStack(match.recipe.output as ItemStack) : null;
}

export function craftOnce(grid: CraftingGrid, inventory: PlayerInventory, items: ItemRegistry, recipes: CraftingRegistry): CraftResult {
  const match = recipes.findMatch(grid);
  if (!match) return { crafted: false, output: null };
  const output = cloneStack(match.recipe.output as ItemStack);
  if (!inventory.canFullyInsert(output, items)) return { crafted: false, output };
  grid.consume(match.consumedSlots, items);
  const remainder = inventory.insert(output, items);
  if (remainder) throw new Error('Inventory capacity changed during crafting.');
  return { crafted: true, output };
}

export function craftMany(grid: CraftingGrid, inventory: PlayerInventory, items: ItemRegistry, recipes: CraftingRegistry, maxCrafts = 64): number {
  if (!Number.isInteger(maxCrafts) || maxCrafts < 1) throw new RangeError('maxCrafts must be a positive integer.');
  let crafted = 0;
  while (crafted < maxCrafts && craftOnce(grid, inventory, items, recipes).crafted) crafted += 1;
  return crafted;
}
