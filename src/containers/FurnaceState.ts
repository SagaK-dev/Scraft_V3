import { Inventory } from '../inventory/Inventory.ts';
import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { createStack } from '../items/ItemStack.ts';
import { fuelSecondsFor, furnaceRecipeFor } from './FurnaceRecipes.ts';

export const FURNACE_INPUT_SLOT = 0;
export const FURNACE_FUEL_SLOT = 1;
export const FURNACE_OUTPUT_SLOT = 2;

export class FurnaceState {
  readonly inventory = new Inventory(3);
  private burnRemainingValue = 0;
  private burnTotalValue = 0;
  private cookProgressValue = 0;

  update(dt: number, items: ItemRegistry): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Furnace delta must be finite and non-negative.');
    let remainingDt = dt;
    while (remainingDt > 1e-9) {
      const recipe = this.currentRecipe(items);
      if (!recipe) {
        this.cookProgressValue = 0;
        this.burnRemainingValue = Math.max(0, this.burnRemainingValue - remainingDt);
        break;
      }
      if (this.burnRemainingValue <= 0 && !this.consumeFuel(items)) break;
      const step = Math.min(remainingDt, this.burnRemainingValue, recipe.cookTime - this.cookProgressValue);
      if (step <= 1e-9) break;
      this.burnRemainingValue -= step;
      this.cookProgressValue += step;
      remainingDt -= step;
      if (this.cookProgressValue + 1e-9 >= recipe.cookTime) {
        this.finishRecipe(recipe.outputItemId, items);
        this.cookProgressValue = 0;
      }
    }
  }

  get burnRemaining(): number { return this.burnRemainingValue; }
  get burnFraction(): number { return this.burnTotalValue > 0 ? Math.max(0, Math.min(1, this.burnRemainingValue / this.burnTotalValue)) : 0; }
  get cookFraction(): number {
    const input = this.inventory.get(FURNACE_INPUT_SLOT);
    const recipe = input ? furnaceRecipeFor(input.itemId) : null;
    return recipe ? Math.max(0, Math.min(1, this.cookProgressValue / recipe.cookTime)) : 0;
  }

  canAcceptInput(itemId: number): boolean { return furnaceRecipeFor(itemId) !== null; }
  canAcceptFuel(itemId: number): boolean { return fuelSecondsFor(itemId) > 0; }
  snapshotContents() { return this.inventory.snapshot(); }

  private currentRecipe(items: ItemRegistry) {
    const input = this.inventory.get(FURNACE_INPUT_SLOT);
    if (!input) return null;
    const recipe = furnaceRecipeFor(input.itemId);
    if (!recipe) return null;
    const output = this.inventory.get(FURNACE_OUTPUT_SLOT);
    if (!output) return recipe;
    if (output.itemId !== recipe.outputItemId) return null;
    return output.count < items.get(output.itemId).maxStack ? recipe : null;
  }

  private consumeFuel(items: ItemRegistry): boolean {
    const fuel = this.inventory.get(FURNACE_FUEL_SLOT);
    if (!fuel) return false;
    const seconds = fuelSecondsFor(fuel.itemId);
    if (seconds <= 0) return false;
    this.inventory.remove(FURNACE_FUEL_SLOT, 1);
    this.burnRemainingValue = seconds;
    this.burnTotalValue = seconds;
    items.get(fuel.itemId);
    return true;
  }

  private finishRecipe(outputItemId: number, items: ItemRegistry): void {
    this.inventory.remove(FURNACE_INPUT_SLOT, 1);
    const output = this.inventory.get(FURNACE_OUTPUT_SLOT);
    if (!output) this.inventory.set(FURNACE_OUTPUT_SLOT, createStack(items, outputItemId), items);
    else {
      output.count += 1;
      this.inventory.set(FURNACE_OUTPUT_SLOT, output, items);
    }
  }
}
