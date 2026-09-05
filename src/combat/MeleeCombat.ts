import type { ItemDefinition } from '../items/Item.ts';

export const MELEE_RANGE = 3.1;
export const BASE_MELEE_COOLDOWN = 0.5;

export class MeleeCombat {
  private cooldown = 0;
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Combat delta must be finite and non-negative.');
    this.cooldown = Math.max(0, this.cooldown - dt);
  }
  tryAttack(item: ItemDefinition | null): { attacked: boolean; damage: number } {
    if (this.cooldown > 0) return { attacked: false, damage: 0 };
    this.cooldown = BASE_MELEE_COOLDOWN;
    return { attacked: true, damage: meleeDamageFor(item) };
  }
  get ready(): boolean { return this.cooldown <= 0; }
}

export function meleeDamageFor(item: ItemDefinition | null): number {
  if (!item?.tool) return 1;
  if (item.tool.kind === 'axe') return 4 + item.tool.tier;
  if (item.tool.kind === 'pickaxe') return 2 + item.tool.tier * 0.5;
  return 1.5 + item.tool.tier * 0.5;
}
