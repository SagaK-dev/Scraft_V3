import { Inventory } from '../inventory/Inventory.ts';
import type { ItemRegistry } from '../items/ItemRegistry.ts';
import type { ItemStack } from '../items/ItemStack.ts';
import { FurnaceState } from './FurnaceState.ts';
import { tryDrainInto } from './ContainerTransfer.ts';

function blockEntityKey(x: number, y: number, z: number): string {
  if (![x, y, z].every(Number.isInteger)) throw new TypeError('Block entity coordinates must be integers.');
  return `${x},${y},${z}`;
}

export class BlockEntityStore {
  private readonly chests = new Map<string, Inventory>();
  private readonly furnaces = new Map<string, FurnaceState>();

  getChest(x: number, y: number, z: number): Inventory {
    const key = blockEntityKey(x, y, z);
    let chest = this.chests.get(key);
    if (!chest) {
      chest = new Inventory(27);
      this.chests.set(key, chest);
    }
    return chest;
  }

  getFurnace(x: number, y: number, z: number): FurnaceState {
    const key = blockEntityKey(x, y, z);
    let furnace = this.furnaces.get(key);
    if (!furnace) {
      furnace = new FurnaceState();
      this.furnaces.set(key, furnace);
    }
    return furnace;
  }

  update(dt: number, items: ItemRegistry): void {
    for (const furnace of this.furnaces.values()) furnace.update(dt, items);
  }

  canDrainAt(x: number, y: number, z: number, target: Inventory, items: ItemRegistry, extras: readonly ItemStack[] = []): boolean {
    const temp = new Inventory(target.size);
    const targetSnapshot = target.snapshot();
    for (let i = 0; i < targetSnapshot.length; i += 1) temp.set(i, targetSnapshot[i] ?? null, items);

    const key = blockEntityKey(x, y, z);
    const chest = this.chests.get(key);
    if (chest && !canInsertSnapshot(chest.snapshot(), temp, items)) return false;
    const furnace = this.furnaces.get(key);
    if (furnace && !canInsertSnapshot(furnace.inventory.snapshot(), temp, items)) return false;
    for (const stack of extras) if (temp.insert(stack, items)) return false;
    return true;
  }

  tryDrainAt(x: number, y: number, z: number, target: Inventory, items: ItemRegistry): boolean {
    if (!this.canDrainAt(x, y, z, target, items)) return false;
    const key = blockEntityKey(x, y, z);
    const chest = this.chests.get(key);
    if (chest && !tryDrainInto(chest, target, items)) throw new Error('Chest drain diverged from preflight.');
    const furnace = this.furnaces.get(key);
    if (furnace && !tryDrainInto(furnace.inventory, target, items)) throw new Error('Furnace drain diverged from preflight.');
    return true;
  }

  remove(x: number, y: number, z: number): void {
    const key = blockEntityKey(x, y, z);
    this.chests.delete(key);
    this.furnaces.delete(key);
  }

  get size(): number { return this.chests.size + this.furnaces.size; }
}

function canInsertSnapshot(snapshot: readonly (ItemStack | null)[], target: Inventory, items: ItemRegistry): boolean {
  for (const stack of snapshot) {
    if (stack && target.insert(stack, items)) return false;
  }
  return true;
}
