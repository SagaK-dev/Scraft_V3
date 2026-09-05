import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { cloneStack, type ItemStack } from '../items/ItemStack.ts';
import type { MutableSlots } from '../inventory/Inventory.ts';

export class CraftingGrid implements MutableSlots {
  readonly width: number;
  readonly height: number;
  readonly size: number;
  private readonly slots: Array<ItemStack | null>;

  constructor(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 3 || height > 3) {
      throw new RangeError('Crafting grid dimensions must be 1..3.');
    }
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.slots = Array.from({ length: this.size }, () => null);
  }

  get(index: number): ItemStack | null {
    this.assertIndex(index);
    const stack = this.slots[index];
    return stack ? cloneStack(stack) : null;
  }

  set(index: number, stack: ItemStack | null, items: ItemRegistry): void {
    this.assertIndex(index);
    if (stack) {
      const item = items.get(stack.itemId);
      if (!Number.isInteger(stack.count) || stack.count < 1 || stack.count > item.maxStack) throw new RangeError('Invalid crafting stack count.');
      if (item.tool && stack.count !== 1) throw new RangeError('Tools cannot stack in crafting grids.');
    }
    this.slots[index] = stack ? cloneStack(stack) : null;
  }

  snapshot(): readonly (ItemStack | null)[] {
    return this.slots.map(stack => stack ? cloneStack(stack) : null);
  }

  consume(indices: readonly number[], items: ItemRegistry): void {
    for (const index of indices) {
      const stack = this.get(index);
      if (!stack) throw new Error('Crafting input changed before consumption.');
      stack.count -= 1;
      this.set(index, stack.count > 0 ? stack : null, items);
    }
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) throw new RangeError('Crafting slot is out of range.');
  }
}
