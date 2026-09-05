import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { canStackTogether, cloneStack, createStack, type ItemStack } from '../items/ItemStack.ts';

export interface MutableSlots {
  readonly size: number;
  get(index: number): ItemStack | null;
  set(index: number, stack: ItemStack | null, items: ItemRegistry): void;
}

export class Inventory implements MutableSlots {
  readonly size: number;
  private readonly slots: Array<ItemStack | null>;

  constructor(size: number) {
    if (!Number.isInteger(size) || size < 1) throw new RangeError('Inventory size must be a positive integer.');
    this.size = size;
    this.slots = Array.from({ length: size }, () => null);
  }

  get(index: number): ItemStack | null {
    this.assertIndex(index);
    const stack = this.slots[index];
    return stack ? cloneStack(stack) : null;
  }

  set(index: number, stack: ItemStack | null, items: ItemRegistry): void {
    this.assertIndex(index);
    if (stack) this.validateStack(stack, items);
    this.slots[index] = stack ? cloneStack(stack) : null;
  }

  insert(stack: ItemStack, items: ItemRegistry, indices?: readonly number[]): ItemStack | null {
    this.validateStack(stack, items);
    const targets = indices ?? Array.from({ length: this.size }, (_, index) => index);
    let remaining = cloneStack(stack);
    for (const index of targets) {
      this.assertIndex(index);
      const current = this.slots[index];
      if (!current || !canStackTogether(current, remaining, items)) continue;
      const limit = items.get(current.itemId).maxStack;
      const moved = Math.min(remaining.count, limit - current.count);
      if (moved <= 0) continue;
      current.count += moved;
      remaining.count -= moved;
      if (remaining.count === 0) return null;
    }
    for (const index of targets) {
      const current = this.slots[index];
      if (current) continue;
      const limit = items.get(remaining.itemId).maxStack;
      const moved = Math.min(remaining.count, limit);
      this.slots[index] = createStack(items, remaining.itemId, moved, remaining.damage);
      remaining.count -= moved;
      if (remaining.count === 0) return null;
    }
    return remaining;
  }

  canFullyInsert(stack: ItemStack, items: ItemRegistry, indices?: readonly number[]): boolean {
    this.validateStack(stack, items);
    const targets = indices ?? Array.from({ length: this.size }, (_, index) => index);
    let capacity = 0;
    const limit = items.get(stack.itemId).maxStack;
    for (const index of targets) {
      this.assertIndex(index);
      const current = this.slots[index];
      if (!current) capacity += limit;
      else if (canStackTogether(current, stack, items)) capacity += Math.max(0, limit - current.count);
      if (capacity >= stack.count) return true;
    }
    return false;
  }

  remove(index: number, count: number): ItemStack | null {
    this.assertIndex(index);
    if (!Number.isInteger(count) || count < 1) throw new RangeError('Remove count must be a positive integer.');
    const current = this.slots[index];
    if (!current) return null;
    const moved = Math.min(count, current.count);
    const result = { itemId: current.itemId, count: moved, damage: current.damage };
    current.count -= moved;
    if (current.count === 0) this.slots[index] = null;
    return result;
  }

  countItem(itemId: number): number {
    let total = 0;
    for (const stack of this.slots) if (stack?.itemId === itemId) total += stack.count;
    return total;
  }

  snapshot(): readonly (ItemStack | null)[] {
    return this.slots.map(stack => stack ? cloneStack(stack) : null);
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) throw new RangeError(`Inventory slot ${index} is out of range.`);
  }

  private validateStack(stack: ItemStack, items: ItemRegistry): void {
    const item = items.get(stack.itemId);
    if (!Number.isInteger(stack.count) || stack.count < 1 || stack.count > item.maxStack) throw new RangeError(`Invalid stack count for ${item.name}.`);
    if (!Number.isInteger(stack.damage) || stack.damage < 0) throw new RangeError('Invalid item damage.');
    if (!item.tool && stack.damage !== 0) throw new RangeError('Non-tool item has durability damage.');
    if (item.tool && stack.damage >= item.tool.maxDurability) throw new RangeError('Broken tool cannot be stored.');
  }
}

export function transferStack(source: MutableSlots, sourceIndex: number, target: MutableSlots, targetIndex: number, items: ItemRegistry): boolean {
  const from = source.get(sourceIndex);
  if (!from) return false;
  const to = target.get(targetIndex);
  if (!to) {
    target.set(targetIndex, from, items);
    source.set(sourceIndex, null, items);
    return true;
  }
  if (canStackTogether(from, to, items)) {
    const limit = items.get(to.itemId).maxStack;
    const moved = Math.min(from.count, limit - to.count);
    if (moved <= 0) return false;
    to.count += moved;
    from.count -= moved;
    target.set(targetIndex, to, items);
    source.set(sourceIndex, from.count > 0 ? from : null, items);
    return true;
  }
  target.set(targetIndex, from, items);
  source.set(sourceIndex, to, items);
  return true;
}

export function takeHalf(source: MutableSlots, index: number, items: ItemRegistry): ItemStack | null {
  const stack = source.get(index);
  if (!stack) return null;
  const count = Math.ceil(stack.count / 2);
  const held = { itemId: stack.itemId, count, damage: stack.damage };
  stack.count -= count;
  source.set(index, stack.count > 0 ? stack : null, items);
  return held;
}

export function placeOne(target: MutableSlots, index: number, held: ItemStack, items: ItemRegistry): ItemStack | null {
  const current = target.get(index);
  if (!current) {
    target.set(index, { itemId: held.itemId, count: 1, damage: held.damage }, items);
  } else if (canStackTogether(current, held, items) && current.count < items.get(current.itemId).maxStack) {
    current.count += 1;
    target.set(index, current, items);
  } else {
    return held;
  }
  const remaining = cloneStack(held);
  remaining.count -= 1;
  return remaining.count > 0 ? remaining : null;
}
