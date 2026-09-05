import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory/Inventory.ts';
import { createDefaultItemRegistry, ItemIds } from '../src/items/ItemRegistry.ts';
import { createStack } from '../src/items/ItemStack.ts';
import { BlockEntityStore } from '../src/containers/BlockEntityStore.ts';
import { FURNACE_FUEL_SLOT, FURNACE_INPUT_SLOT, FURNACE_OUTPUT_SLOT, FurnaceState } from '../src/containers/FurnaceState.ts';
import { MeleeCombat, meleeDamageFor } from '../src/combat/MeleeCombat.ts';
import { DayNightCycle, DAY_LENGTH_SECONDS } from '../src/survival/DayNightCycle.ts';
import { SurvivalState, fallDamageFor } from '../src/survival/SurvivalState.ts';

const items = createDefaultItemRegistry();

test('fall damage starts after three safe blocks', () => {
  assert.equal(fallDamageFor(3.99), 0);
  assert.equal(fallDamageFor(4), 1);
  assert.equal(fallDamageFor(8.8), 5);
});

test('well-fed player naturally regenerates on the four-second cadence', () => {
  const state = new SurvivalState();
  state.damage(10);
  const result = state.update(4);
  assert.equal(result.healed, 1);
  assert.equal(state.health, 11);
});

test('exhaustion drains saturation before hunger', () => {
  const state = new SurvivalState();
  state.addExhaustion(20);
  assert.equal(state.saturation, 0);
  assert.equal(state.hunger, 20);
  state.addExhaustion(4);
  assert.equal(state.hunger, 19);
});

test('starvation damages after hunger reaches zero', () => {
  const state = new SurvivalState();
  state.addExhaustion(100);
  assert.equal(state.hunger, 0);
  state.update(4);
  assert.equal(state.health, 19);
});

test('food restores hunger and clamps to maximum', () => {
  const state = new SurvivalState();
  state.addExhaustion(40);
  const before = state.hunger;
  assert.equal(state.eat(4, 2.4), true);
  assert.equal(state.hunger, Math.min(20, before + 4));
});

test('day/night cycle wraps deterministically', () => {
  const cycle = new DayNightCycle(0.99);
  cycle.update(DAY_LENGTH_SECONDS * 0.02);
  assert.ok(Math.abs(cycle.normalizedTime - 0.01) < 1e-9);
});

test('daylight is stronger at noon than midnight', () => {
  const cycle = new DayNightCycle();
  cycle.setNormalizedTime(0.5);
  const noon = cycle.daylight;
  cycle.setNormalizedTime(0);
  assert.ok(noon > cycle.daylight);
});

test('melee cooldown prevents click-spam attacks', () => {
  const combat = new MeleeCombat();
  assert.equal(combat.tryAttack(items.get(ItemIds.WOODEN_AXE)).attacked, true);
  assert.equal(combat.tryAttack(null).attacked, false);
  combat.update(0.5);
  assert.equal(combat.tryAttack(null).attacked, true);
});

test('axe melee damage exceeds empty-hand damage', () => {
  assert.ok(meleeDamageFor(items.get(ItemIds.WOODEN_AXE)) > meleeDamageFor(null));
});

test('furnace smelts sand into glass with wood fuel', () => {
  const furnace = new FurnaceState();
  furnace.inventory.set(FURNACE_INPUT_SLOT, createStack(items, ItemIds.SAND, 2), items);
  furnace.inventory.set(FURNACE_FUEL_SLOT, createStack(items, ItemIds.WOOD), items);
  furnace.update(8, items);
  assert.equal(furnace.inventory.get(FURNACE_OUTPUT_SLOT)?.itemId, ItemIds.GLASS);
  assert.equal(furnace.inventory.get(FURNACE_INPUT_SLOT)?.count, 1);
});

test('furnace does not consume fuel when output slot is incompatible', () => {
  const furnace = new FurnaceState();
  furnace.inventory.set(FURNACE_INPUT_SLOT, createStack(items, ItemIds.SAND), items);
  furnace.inventory.set(FURNACE_FUEL_SLOT, createStack(items, ItemIds.WOOD), items);
  furnace.inventory.set(FURNACE_OUTPUT_SLOT, createStack(items, ItemIds.DIRT), items);
  furnace.update(20, items);
  assert.equal(furnace.inventory.get(FURNACE_INPUT_SLOT)?.count, 1);
  assert.equal(furnace.inventory.get(FURNACE_FUEL_SLOT)?.count, 1);
});

test('block entity store preserves chest and furnace contents by signed coordinates', () => {
  const store = new BlockEntityStore();
  store.getChest(-1, 2, -3).set(0, createStack(items, ItemIds.APPLE, 3), items);
  assert.equal(store.getChest(-1, 2, -3).get(0)?.count, 3);
  store.getFurnace(1, 2, 3).inventory.set(FURNACE_INPUT_SLOT, createStack(items, ItemIds.SAND), items);
  assert.equal(store.size, 2);
});

test('container drain is transactional when player inventory has no room', () => {
  const store = new BlockEntityStore();
  const chest = store.getChest(1, 2, 3);
  chest.set(0, createStack(items, ItemIds.APPLE, 4), items);
  const target = new Inventory(1);
  target.set(0, createStack(items, ItemIds.DIRT, 64), items);
  assert.equal(store.tryDrainAt(1, 2, 3, target, items), false);
  assert.equal(chest.get(0)?.count, 4);
});

test('container preflight includes the container block drop itself', () => {
  const store = new BlockEntityStore();
  const chest = store.getChest(2, 3, 4);
  chest.set(0, createStack(items, ItemIds.APPLE), items);
  const player = new Inventory(2);
  player.set(0, createStack(items, ItemIds.DIRT, 64), items);
  player.set(1, createStack(items, ItemIds.APPLE, 63), items);
  assert.equal(store.canDrainAt(2, 3, 4, player, items, [createStack(items, ItemIds.CHEST)]), false);
  assert.equal(chest.get(0)?.itemId, ItemIds.APPLE);
});


test('extractAt returns container contents and removes stored block entity state', () => {
  const store = new BlockEntityStore();
  store.getChest(-4, 5, -6).set(0, createStack(items, ItemIds.APPLE, 2), items);
  const extracted = store.extractAt(-4, 5, -6);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0]?.itemId, ItemIds.APPLE);
  assert.equal(extracted[0]?.count, 2);
  assert.equal(store.size, 0);
  assert.equal(store.getChest(-4, 5, -6).get(0), null);
});
