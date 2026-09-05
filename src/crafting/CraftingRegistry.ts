import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { ItemIds } from '../items/ItemRegistry.ts';
import { createStack } from '../items/ItemStack.ts';
import type { CraftingGrid } from './CraftingGrid.ts';
import type { CraftingRecipe, RecipeMatch } from './CraftingRecipe.ts';
import { validateRecipe } from './CraftingRecipe.ts';

export class CraftingRegistry {
  private readonly recipes: CraftingRecipe[] = [];
  private readonly ids = new Set<string>();
  register(recipe: CraftingRecipe): this { validateRecipe(recipe); if (this.ids.has(recipe.id)) throw new Error(`Recipe ${recipe.id} is already registered.`); this.ids.add(recipe.id); this.recipes.push(Object.freeze({ ...recipe, pattern: Object.freeze([...recipe.pattern]), output: Object.freeze({ ...recipe.output }) })); return this; }
  findMatch(grid: CraftingGrid): RecipeMatch | null { for (const recipe of this.recipes) { const direct = matchRecipe(grid, recipe, false); if (direct) return { recipe, consumedSlots: direct }; if (recipe.allowMirror && recipe.width > 1) { const mirrored = matchRecipe(grid, recipe, true); if (mirrored) return { recipe, consumedSlots: mirrored }; } } return null; }
  get size(): number { return this.recipes.length; }
}

function matchRecipe(grid: CraftingGrid, recipe: CraftingRecipe, mirror: boolean): number[] | null {
  if (recipe.width > grid.width || recipe.height > grid.height) return null;
  for (let offsetY = 0; offsetY <= grid.height - recipe.height; offsetY += 1) {
    for (let offsetX = 0; offsetX <= grid.width - recipe.width; offsetX += 1) {
      const consumed: number[] = [];
      let valid = true;
      for (let gridY = 0; gridY < grid.height && valid; gridY += 1) {
        for (let gridX = 0; gridX < grid.width; gridX += 1) {
          const inside = gridX >= offsetX && gridX < offsetX + recipe.width && gridY >= offsetY && gridY < offsetY + recipe.height;
          let expected: number | null = null;
          if (inside) {
            const recipeX = mirror ? recipe.width - 1 - (gridX - offsetX) : gridX - offsetX;
            expected = recipe.pattern[(gridY - offsetY) * recipe.width + recipeX] ?? null;
          }
          const index = gridY * grid.width + gridX;
          const actual = grid.get(index);
          if (expected === null) { if (actual !== null) { valid = false; break; } }
          else if (actual?.itemId === expected) consumed.push(index);
          else { valid = false; break; }
        }
      }
      if (valid) return consumed;
    }
  }
  return null;
}

export function createDefaultCraftingRegistry(items: ItemRegistry): CraftingRegistry {
  return new CraftingRegistry()
    .register({ id: 'planks_from_wood', width: 1, height: 1, pattern: [ItemIds.WOOD], output: createStack(items, ItemIds.PLANKS, 4), allowMirror: false })
    .register({ id: 'sticks', width: 1, height: 2, pattern: [ItemIds.PLANKS, ItemIds.PLANKS], output: createStack(items, ItemIds.STICK, 4), allowMirror: false })
    .register({ id: 'crafting_table', width: 2, height: 2, pattern: [ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS], output: createStack(items, ItemIds.CRAFTING_TABLE, 1), allowMirror: false })
    .register({ id: 'wooden_pickaxe', width: 3, height: 3, pattern: [ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS, null, ItemIds.STICK, null, null, ItemIds.STICK, null], output: createStack(items, ItemIds.WOODEN_PICKAXE), allowMirror: false })
    .register({ id: 'wooden_axe', width: 2, height: 3, pattern: [ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.STICK, null, ItemIds.STICK], output: createStack(items, ItemIds.WOODEN_AXE), allowMirror: true })
    .register({ id: 'wooden_shovel', width: 1, height: 3, pattern: [ItemIds.PLANKS, ItemIds.STICK, ItemIds.STICK], output: createStack(items, ItemIds.WOODEN_SHOVEL), allowMirror: false })
    .register({ id: 'stone_pickaxe', width: 3, height: 3, pattern: [ItemIds.STONE, ItemIds.STONE, ItemIds.STONE, null, ItemIds.STICK, null, null, ItemIds.STICK, null], output: createStack(items, ItemIds.STONE_PICKAXE), allowMirror: false })
    .register({ id: 'furnace', width: 3, height: 3, pattern: [ItemIds.STONE, ItemIds.STONE, ItemIds.STONE, ItemIds.STONE, null, ItemIds.STONE, ItemIds.STONE, ItemIds.STONE, ItemIds.STONE], output: createStack(items, ItemIds.FURNACE), allowMirror: false })
    .register({ id: 'chest', width: 3, height: 3, pattern: [ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS, null, ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS, ItemIds.PLANKS], output: createStack(items, ItemIds.CHEST), allowMirror: false });
}
