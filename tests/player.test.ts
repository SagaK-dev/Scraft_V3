import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTowards } from '../src/player/movement.ts';

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
