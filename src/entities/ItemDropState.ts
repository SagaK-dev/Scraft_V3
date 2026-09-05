import type { ItemStack } from '../items/ItemStack.ts';
import { cloneStack } from '../items/ItemStack.ts';

export const ITEM_PICKUP_DELAY = 0.35;
export const ITEM_DROP_LIFETIME = 300;

export class ItemDropState {
  readonly stack: ItemStack;
  private ageValue = 0;
  constructor(stack: ItemStack) { this.stack = cloneStack(stack); }
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Item drop delta must be finite and non-negative.');
    this.ageValue += dt;
  }
  get age(): number { return this.ageValue; }
  get canPickup(): boolean { return this.ageValue >= ITEM_PICKUP_DELAY; }
  get expired(): boolean { return this.ageValue >= ITEM_DROP_LIFETIME; }
}
