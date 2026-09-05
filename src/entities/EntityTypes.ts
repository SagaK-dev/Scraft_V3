import type { ItemStack } from '../items/ItemStack.ts';

export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type MobKind = 'grazer' | 'stalker';

export interface MobDefinition {
  readonly kind: MobKind;
  readonly name: string;
  readonly passive: boolean;
  readonly maxHealth: number;
  readonly speed: number;
  readonly detectionRange: number;
  readonly meleeRange: number;
  readonly meleeDamage: number;
  readonly width: number;
  readonly height: number;
  readonly color: number;
}

export const MOB_DEFINITIONS: Readonly<Record<MobKind, MobDefinition>> = Object.freeze({
  grazer: Object.freeze({
    kind: 'grazer', name: 'Grazer', passive: true, maxHealth: 10, speed: 2.2,
    detectionRange: 0, meleeRange: 0, meleeDamage: 0, width: 0.75, height: 1.35, color: 0x8abf66,
  }),
  stalker: Object.freeze({
    kind: 'stalker', name: 'Stalker', passive: false, maxHealth: 16, speed: 2.9,
    detectionRange: 16, meleeRange: 1.65, meleeDamage: 3, width: 0.72, height: 1.65, color: 0x9d4242,
  }),
});

export interface MobHit {
  readonly id: number;
  readonly kind: MobKind;
  readonly name: string;
  readonly distance: number;
  readonly health: number;
  readonly maxHealth: number;
}

export interface MobDamageResult {
  readonly damaged: boolean;
  readonly killed: boolean;
  readonly health: number;
  readonly kind: MobKind | null;
}

export interface ItemDropSnapshot {
  readonly id: number;
  readonly stack: ItemStack;
  readonly position: Vec3Like;
}
