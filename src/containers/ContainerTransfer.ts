import { Inventory } from '../inventory/Inventory.ts';
import type { ItemRegistry } from '../items/ItemRegistry.ts';
import type { ItemStack } from '../items/ItemStack.ts';
import type { MutableSlots } from '../inventory/Inventory.ts';

export function tryDrainInto(source: MutableSlots, target: Inventory, items: ItemRegistry): boolean {
  const temp = new Inventory(target.size);
  const targetSnapshot = target.snapshot();
  for (let i = 0; i < targetSnapshot.length; i += 1) temp.set(i, targetSnapshot[i] ?? null, items);
  const sourceStacks: Array<{ index: number; stack: ItemStack }> = [];
  for (let i = 0; i < source.size; i += 1) {
    const stack = source.get(i);
    if (!stack) continue;
    sourceStacks.push({ index: i, stack });
    if (temp.insert(stack, items)) return false;
  }
  for (const { index, stack } of sourceStacks) {
    const remainder = target.insert(stack, items);
    if (remainder) throw new Error('Container drain preflight diverged from commit.');
    source.set(index, null, items);
  }
  return true;
}
