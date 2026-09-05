import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { ItemIds } from '../items/ItemRegistry.ts';
import { cloneStack, createStack, damageTool, type ItemStack } from '../items/ItemStack.ts';
import { Inventory } from './Inventory.ts';

export const HOTBAR_SIZE = 9;
export const MAIN_SIZE = 27;
export const PLAYER_INVENTORY_SIZE = HOTBAR_SIZE + MAIN_SIZE;
const HOTBAR_INDICES = Array.from({ length: HOTBAR_SIZE }, (_, index) => index);
const MAIN_INDICES = Array.from({ length: MAIN_SIZE }, (_, index) => HOTBAR_SIZE + index);

export class PlayerInventory extends Inventory {
  private selected = 0;
  constructor() { super(PLAYER_INVENTORY_SIZE); }
  selectHotbar(index: number): void { if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) throw new RangeError('Hotbar index must be from 0 to 8.'); this.selected = index; }
  cycleHotbar(delta: number): void { if (!Number.isFinite(delta) || delta === 0) return; const direction = delta > 0 ? 1 : -1; this.selected = (this.selected + direction + HOTBAR_SIZE) % HOTBAR_SIZE; }
  get selectedHotbarIndex(): number { return this.selected; }
  get selectedStack(): ItemStack | null { return this.get(this.selected); }
  consumeSelected(count: number, items: ItemRegistry): ItemStack | null { const removed = this.remove(this.selected, count); if (removed) items.get(removed.itemId); return removed; }
  damageSelectedTool(items: ItemRegistry, amount = 1): { damaged: boolean; broken: boolean } { const stack = this.get(this.selected); if (!stack || !items.get(stack.itemId).tool) return { damaged: false, broken: false }; const next = damageTool(stack, items, amount); this.set(this.selected, next, items); return { damaged: true, broken: next === null }; }
  shiftClick(index: number, items: ItemRegistry): boolean { if (!Number.isInteger(index) || index < 0 || index >= PLAYER_INVENTORY_SIZE) throw new RangeError('Player inventory slot is out of range.'); const stack = this.get(index); if (!stack) return false; const targets = index < HOTBAR_SIZE ? MAIN_INDICES : HOTBAR_INDICES; const remainder = this.insert(stack, items, targets); if (!remainder) this.set(index, null, items); else if (remainder.count !== stack.count) this.set(index, remainder, items); else return false; return true; }
  get hotbarSnapshot(): readonly (ItemStack | null)[] { return HOTBAR_INDICES.map(index => this.get(index)).map(stack => stack ? cloneStack(stack) : null); }
}

export function createPhaseFiveStarterInventory(items: ItemRegistry): PlayerInventory {
  const inventory = new PlayerInventory();
  inventory.set(0, createStack(items, ItemIds.WOOD, 8), items);
  inventory.set(1, createStack(items, ItemIds.APPLE, 4), items);
  return inventory;
}
