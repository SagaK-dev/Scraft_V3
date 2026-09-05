import type { ItemRegistry } from './ItemRegistry.ts';

export interface ItemStack {
  readonly itemId: number;
  count: number;
  damage: number;
}

export function createStack(items: ItemRegistry, itemId: number, count = 1, damage = 0): ItemStack {
  const item = items.get(itemId);
  if (!Number.isInteger(count) || count < 1 || count > item.maxStack) throw new RangeError(`Invalid count ${count} for ${item.name}.`);
  if (!Number.isInteger(damage) || damage < 0) throw new RangeError('Item damage must be a non-negative integer.');
  if (!item.tool && damage !== 0) throw new RangeError('Non-tool items cannot have durability damage.');
  if (item.tool && damage >= item.tool.maxDurability) throw new RangeError('A broken tool cannot exist as an inventory stack.');
  return { itemId, count, damage };
}

export function cloneStack(stack: ItemStack): ItemStack {
  return { itemId: stack.itemId, count: stack.count, damage: stack.damage };
}

export function canStackTogether(a: ItemStack, b: ItemStack, items: ItemRegistry): boolean {
  return a.itemId === b.itemId && a.damage === b.damage && items.get(a.itemId).maxStack > 1;
}

export function remainingDurability(stack: ItemStack, items: ItemRegistry): number | null {
  const tool = items.get(stack.itemId).tool;
  return tool ? Math.max(0, tool.maxDurability - stack.damage) : null;
}

export function damageTool(stack: ItemStack, items: ItemRegistry, amount = 1): ItemStack | null {
  const tool = items.get(stack.itemId).tool;
  if (!tool) return cloneStack(stack);
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError('Tool damage amount must be a non-negative integer.');
  const nextDamage = stack.damage + amount;
  if (nextDamage >= tool.maxDurability) return null;
  return { itemId: stack.itemId, count: 1, damage: nextDamage };
}
