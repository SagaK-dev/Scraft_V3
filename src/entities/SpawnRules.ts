import type { MobKind } from './EntityTypes.ts';

export const PASSIVE_CAP = 6;
export const HOSTILE_CAP = 8;
export const MIN_SPAWN_DISTANCE = 14;
export const MAX_SPAWN_DISTANCE = 28;
export const DESPAWN_DISTANCE = 52;

export interface SpawnContext {
  readonly seed: number;
  readonly cycle: number;
  readonly playerX: number;
  readonly playerZ: number;
  readonly daylight: number;
  readonly passiveCount: number;
  readonly hostileCount: number;
  readonly attempts?: number;
}

export interface SpawnCandidate {
  readonly kind: MobKind;
  readonly x: number;
  readonly z: number;
}

export function planMobSpawns(context: SpawnContext): SpawnCandidate[] {
  validateContext(context);
  const attempts = Math.max(1, Math.min(8, Math.floor(context.attempts ?? 4)));
  const candidates: SpawnCandidate[] = [];
  let passiveRemaining = Math.max(0, PASSIVE_CAP - context.passiveCount);
  let hostileRemaining = Math.max(0, HOSTILE_CAP - context.hostileCount);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const r0 = unitHash(context.seed, context.cycle, attempt, 0x31d4);
    const r1 = unitHash(context.seed, context.cycle, attempt, 0x7a91);
    const r2 = unitHash(context.seed, context.cycle, attempt, 0xb53f);
    const kind = chooseKind(context.daylight, r2, passiveRemaining, hostileRemaining);
    if (!kind) continue;
    const angle = r0 * Math.PI * 2;
    const radius = MIN_SPAWN_DISTANCE + r1 * (MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE);
    candidates.push({
      kind,
      x: Math.floor(context.playerX + Math.cos(angle) * radius) + 0.5,
      z: Math.floor(context.playerZ + Math.sin(angle) * radius) + 0.5,
    });
    if (kind === 'grazer') passiveRemaining -= 1;
    else hostileRemaining -= 1;
  }
  return candidates;
}

export function shouldDespawnMob(distanceFromPlayer: number): boolean {
  if (!Number.isFinite(distanceFromPlayer) || distanceFromPlayer < 0) throw new RangeError('Mob distance must be finite and non-negative.');
  return distanceFromPlayer > DESPAWN_DISTANCE;
}

function chooseKind(daylight: number, random: number, passiveRemaining: number, hostileRemaining: number): MobKind | null {
  if (daylight >= 0.5) return passiveRemaining > 0 && random < 0.72 ? 'grazer' : null;
  if (daylight <= 0.25) return hostileRemaining > 0 && random < 0.86 ? 'stalker' : null;
  if (daylight < 0.5 && hostileRemaining > 0 && random < (0.5 - daylight) * 1.7) return 'stalker';
  if (passiveRemaining > 0 && random > 0.55) return 'grazer';
  return null;
}

function validateContext(context: SpawnContext): void {
  if (!Number.isInteger(context.seed) || context.seed < 0) throw new RangeError('Spawn seed must be an unsigned integer.');
  if (!Number.isInteger(context.cycle) || context.cycle < 0) throw new RangeError('Spawn cycle must be a non-negative integer.');
  if (![context.playerX, context.playerZ, context.daylight].every(Number.isFinite)) throw new RangeError('Spawn context must be finite.');
  if (context.daylight < 0 || context.daylight > 1) throw new RangeError('Daylight must be from 0 to 1.');
}

function unitHash(seed: number, cycle: number, attempt: number, salt: number): number {
  let x = (seed ^ Math.imul(cycle + 1, 0x9e3779b1) ^ Math.imul(attempt + 1, salt)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}
