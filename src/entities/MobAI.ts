import type { MobDefinition } from './EntityTypes.ts';

export type HostileIntent = 'idle' | 'chase' | 'melee' | 'ranged-chase';

export interface HostileDecision {
  readonly intent: HostileIntent;
  readonly shouldMelee: boolean;
  readonly shouldShoot: boolean;
  readonly shouldChase: boolean;
}

export function decideHostileAction(
  definition: MobDefinition,
  distance: number,
  verticalDistance: number,
  meleeReady: boolean,
  projectileReady: boolean,
  hasLineOfSight: boolean,
): HostileDecision {
  if (![distance, verticalDistance].every(Number.isFinite) || distance < 0 || verticalDistance < 0) throw new RangeError('Mob AI distances must be finite and non-negative.');
  if (definition.passive || distance > definition.detectionRange || verticalDistance >= 7) {
    return { intent: 'idle', shouldMelee: false, shouldShoot: false, shouldChase: false };
  }
  const shouldMelee = distance <= definition.meleeRange && verticalDistance <= 2 && meleeReady && hasLineOfSight;
  const shouldShoot = distance >= 4.5 && distance <= 10 && verticalDistance <= 5 && projectileReady && hasLineOfSight;
  const shouldChase = distance > definition.meleeRange * 0.88;
  return {
    intent: shouldMelee ? 'melee' : shouldShoot ? 'ranged-chase' : shouldChase ? 'chase' : 'idle',
    shouldMelee,
    shouldShoot,
    shouldChase,
  };
}
