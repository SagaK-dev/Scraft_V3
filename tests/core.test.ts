import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStep } from '../src/core/FixedStep.ts';
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings } from '../src/core/Settings.ts';
import { floorDiv, positiveMod, splitCoordinate } from '../src/world/coordinates.ts';

test('fixed step executes deterministic updates', () => {
  const clock = new FixedStep(0.01, 5);
  let updates = 0;
  const alpha = clock.advance(0.035, () => { updates += 1; });
  assert.equal(updates, 3);
  assert.ok(alpha > 0.49 && alpha < 0.51);
});

test('fixed step caps catch-up work', () => {
  const clock = new FixedStep(0.01, 3);
  let updates = 0;
  clock.advance(10, () => { updates += 1; });
  assert.equal(updates, 3);
});

test('negative world coordinates split correctly', () => {
  assert.deepEqual(splitCoordinate(-0.1), { block: -1, chunk: -1, local: 15 });
  assert.deepEqual(splitCoordinate(-16), { block: -16, chunk: -1, local: 0 });
  assert.deepEqual(splitCoordinate(-16.01), { block: -17, chunk: -2, local: 15 });
});

test('coordinate helpers reject invalid divisor/modulus', () => {
  assert.throws(() => floorDiv(1, 0), RangeError);
  assert.throws(() => positiveMod(1, -1), RangeError);
});

test('settings sanitization clamps unsafe values', () => {
  const value = sanitizeSettings({ fov: 999, sensitivity: -2, renderDistance: 99, masterVolume: 3 });
  assert.equal(value.fov, 110);
  assert.equal(value.sensitivity, 0.02);
  assert.equal(value.renderDistance, 24);
  assert.equal(value.masterVolume, 1);
});

test('settings load/save tolerate storage failures', () => {
  const broken = { getItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadSettings(broken), DEFAULT_SETTINGS);
  assert.equal(saveSettings(DEFAULT_SETTINGS, { setItem: () => { throw new Error('blocked'); } }), false);
});
