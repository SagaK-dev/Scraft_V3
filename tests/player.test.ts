import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTowards } from '../src/player/movement.ts';
import { createAABB, hasSupport, intersectsSolid, moveAABB, type VoxelCollisionSource } from '../src/player/VoxelPhysics.ts';

test('moveTowards reaches a nearby target without overshoot', () => {
  assert.equal(moveTowards(1, 1.2, 0.5), 1.2);
});

test('moveTowards advances in both directions', () => {
  assert.equal(moveTowards(0, 10, 2), 2);
  assert.equal(moveTowards(0, -10, 2), -2);
});

test('moveTowards is stable when current equals target', () => {
  assert.equal(moveTowards(4, 4, 3), 4);
});

test('moveTowards rejects negative maxDelta', () => {
  assert.throws(() => moveTowards(0, 1, -1), RangeError);
});

function collisionSource(predicate: (x: number, y: number, z: number) => boolean): VoxelCollisionSource {
  return { isSolidBlock: predicate };
}

test('voxel physics lands on a floor and reports grounded', () => {
  const source = collisionSource((_x, y) => y === -1);
  const start = createAABB(0, 2, 0, 0.3, 1.8);
  const result = moveAABB(start, { x: 0, y: -5, z: 0 }, source);
  assert.ok(Math.abs(result.bounds.minY) < 1e-6);
  assert.equal(result.grounded, true);
  assert.equal(result.hitY, true);
});

test('swept AABB prevents tunneling through a one-block wall', () => {
  const source = collisionSource((x, y, z) => x === 1 && y >= 0 && y <= 1 && z === 0);
  const start = createAABB(0, 0, 0.5, 0.3, 1.8);
  const result = moveAABB(start, { x: 5, y: 0, z: 0 }, source);
  assert.ok(Math.abs(result.moved.x - 0.7) < 1e-6);
  assert.equal(result.hitX, true);
  assert.equal(intersectsSolid(result.bounds, source), false);
});

test('voxel physics stops upward movement at a ceiling', () => {
  const source = collisionSource((x, y, z) => y === 2 && x === 0 && z === 0);
  const start = createAABB(0.5, 0, 0.5, 0.3, 1.8);
  const result = moveAABB(start, { x: 0, y: 2, z: 0 }, source);
  assert.ok(Math.abs(result.moved.y - 0.2) < 1e-6);
  assert.equal(result.hitCeiling, true);
});

test('grounded player can auto-step a one-block terrain ledge', () => {
  const source = collisionSource((x, y, z) => y === -1 || (x === 1 && y === 0 && z === 0));
  const start = createAABB(0, 0, 0.5, 0.3, 1.8);
  const result = moveAABB(start, { x: 1.2, y: -0.01, z: 0 }, source, { allowStep: true, stepHeight: 1.001 });
  assert.equal(result.stepped, true);
  assert.ok(result.bounds.minY > 0.99 && result.bounds.minY < 1.01);
  assert.ok(result.moved.x > 1.1);
  assert.equal(result.grounded, true);
});

test('crouch-style supported movement stops at a ledge instead of walking into air', () => {
  const source = collisionSource((x, y, z) => y === -1 && x === 0 && z === 0);
  const start = createAABB(0.5, 0, 0.5, 0.3, 1.5);
  assert.equal(hasSupport(start, source), true);
  const result = moveAABB(start, { x: 1.2, y: 0, z: 0 }, source, { keepSupported: true });
  assert.ok(result.moved.x < 0.9);
  assert.equal(hasSupport(result.bounds, source), true);
});
