import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemDropState, ITEM_DROP_LIFETIME, ITEM_PICKUP_DELAY } from '../src/entities/ItemDropState.ts';
import { ProjectileSystem } from '../src/entities/ProjectileSystem.ts';
import { decideHostileAction } from '../src/entities/MobAI.ts';
import { MOB_DEFINITIONS } from '../src/entities/EntityTypes.ts';
import { findSimplePath } from '../src/entities/SimplePathfinder.ts';
import { DESPAWN_DISTANCE, HOSTILE_CAP, PASSIVE_CAP, planMobSpawns, shouldDespawnMob } from '../src/entities/SpawnRules.ts';
import { segmentAABBIntersectionT, segmentIntersectsAABB } from '../src/entities/EntityMath.ts';
import { createDefaultItemRegistry, ItemIds } from '../src/items/ItemRegistry.ts';
import { createStack } from '../src/items/ItemStack.ts';

const items = createDefaultItemRegistry();

test('spawn planning is deterministic for seed, cycle and player position', () => {
  const context = { seed: 1234, cycle: 9, playerX: -12.25, playerZ: 7.75, daylight: 0.8, passiveCount: 0, hostileCount: 0 };
  assert.deepEqual(planMobSpawns(context), planMobSpawns(context));
});

test('day spawn rules favor passive mobs and night rules favor hostiles', () => {
  const day = planMobSpawns({ seed: 55, cycle: 1, playerX: 0, playerZ: 0, daylight: 1, passiveCount: 0, hostileCount: 0, attempts: 8 });
  assert.ok(day.every(candidate => candidate.kind === 'grazer'));
  const night = planMobSpawns({ seed: 55, cycle: 1, playerX: 0, playerZ: 0, daylight: 0, passiveCount: 0, hostileCount: 0, attempts: 8 });
  assert.ok(night.every(candidate => candidate.kind === 'stalker'));
});

test('spawn rules never exceed remaining mob caps', () => {
  const almostFull = planMobSpawns({ seed: 4, cycle: 2, playerX: 0, playerZ: 0, daylight: 0.5, passiveCount: PASSIVE_CAP - 1, hostileCount: HOSTILE_CAP - 1, attempts: 8 });
  assert.ok(almostFull.filter(candidate => candidate.kind === 'grazer').length <= 1);
  assert.ok(almostFull.filter(candidate => candidate.kind === 'stalker').length <= 1);
});

test('mobs despawn only beyond the configured distance', () => {
  assert.equal(shouldDespawnMob(DESPAWN_DISTANCE), false);
  assert.equal(shouldDespawnMob(DESPAWN_DISTANCE + 0.01), true);
});

test('simple pathfinder routes around a blocked column', () => {
  const blocked = new Set(['1,0']);
  const path = findSimplePath(
    { x: 0.5, y: 1, z: 0.5 },
    { x: 3.5, y: 1, z: 0.5 },
    (x, z) => blocked.has(`${x},${z}`) ? null : 1,
    { maxNodes: 64 },
  );
  assert.ok(path.length >= 5);
  assert.equal(path.some(point => Math.floor(point.x) === 1 && Math.floor(point.z) === 0), false);
  assert.equal(Math.floor(path.at(-1)!.x), 3);
  assert.equal(Math.floor(path.at(-1)!.z), 0);
});

test('simple pathfinder respects changing stand heights', () => {
  const path = findSimplePath(
    { x: 0.5, y: 1, z: 0.5 },
    { x: 2.5, y: 2, z: 0.5 },
    (x, z, fromY) => {
      if (z !== 0) return null;
      const targetY = x >= 1 ? 2 : 1;
      return Math.abs(targetY - fromY) <= 1 ? targetY : null;
    },
  );
  assert.equal(path.at(-1)?.y, 2);
});

test('item drops enforce pickup delay and lifetime', () => {
  const drop = new ItemDropState(createStack(items, ItemIds.STONE, 3));
  assert.equal(drop.canPickup, false);
  drop.update(ITEM_PICKUP_DELAY);
  assert.equal(drop.canPickup, true);
  drop.update(ITEM_DROP_LIFETIME);
  assert.equal(drop.expired, true);
});

test('segment-AABB hit catches fast movement through the player', () => {
  const player = { minX: -0.3, minY: 0, minZ: -0.3, maxX: 0.3, maxY: 1.8, maxZ: 0.3 };
  assert.equal(segmentIntersectsAABB({ x: -5, y: 1, z: 0 }, { x: 5, y: 1, z: 0 }, player), true);
  assert.equal(segmentIntersectsAABB({ x: -5, y: 3, z: 0 }, { x: 5, y: 3, z: 0 }, player), false);
});

test('projectile system emits player hit once and removes the projectile', () => {
  const system = new ProjectileSystem();
  system.spawn('hostile', { x: -4, y: 1, z: 0 }, { x: 20, y: 0, z: 0 }, 3);
  const events = system.update(0.4, {
    worldHitT: () => null,
    playerHitT: (start, end) => segmentAABBIntersectionT(start, end, { minX: -0.3, minY: 0, minZ: -0.3, maxX: 0.3, maxY: 1.8, maxZ: 0.3 }),
  });
  assert.deepEqual(events, [{ type: 'player-hit', projectileId: 1, damage: 3 }]);
  assert.equal(system.size, 0);
});

test('projectile resolves the nearest continuous collision, not hook order', () => {
  const playerFirst = new ProjectileSystem();
  playerFirst.spawn('hostile', { x: 0, y: 1, z: 0 }, { x: 10, y: 0, z: 0 }, 2);
  assert.deepEqual(playerFirst.update(0.2, { worldHitT: () => 0.9, playerHitT: () => 0.4 }), [{ type: 'player-hit', projectileId: 1, damage: 2 }]);

  const wallFirst = new ProjectileSystem();
  wallFirst.spawn('hostile', { x: 0, y: 1, z: 0 }, { x: 10, y: 0, z: 0 }, 2);
  assert.deepEqual(wallFirst.update(0.2, { worldHitT: () => 0.2, playerHitT: () => 0.7 }), [{ type: 'blocked', projectileId: 1 }]);
});

test('hostile AI chases, attacks and shoots only inside its rules', () => {
  const hostile = MOB_DEFINITIONS.stalker;
  assert.equal(decideHostileAction(hostile, 12, 0, true, true, true).shouldChase, true);
  assert.equal(decideHostileAction(hostile, 1.2, 0, true, true, true).shouldMelee, true);
  assert.equal(decideHostileAction(hostile, 7, 0, false, true, true).shouldShoot, true);
  assert.equal(decideHostileAction(hostile, 20, 0, true, true, true).intent, 'idle');
});

test('hostile melee cannot attack through walls or large vertical gaps', () => {
  const hostile = MOB_DEFINITIONS.stalker;
  assert.equal(decideHostileAction(hostile, 1.2, 0, true, false, false).shouldMelee, false);
  assert.equal(decideHostileAction(hostile, 1.2, 2.1, true, false, true).shouldMelee, false);
  assert.equal(decideHostileAction(hostile, 1.2, 1.9, true, false, true).shouldMelee, true);
});
