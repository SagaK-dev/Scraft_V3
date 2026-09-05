import test from 'node:test';
import assert from 'node:assert/strict';
import { CraftingGrid } from '../src/crafting/CraftingGrid.ts';
import { createDefaultCraftingRegistry } from '../src/crafting/CraftingRegistry.ts';
import { craftOnce, previewCraft } from '../src/crafting/CraftingService.ts';
import { Inventory, placeOne, takeHalf, transferStack } from '../src/inventory/Inventory.ts';
import { PlayerInventory } from '../src/inventory/PlayerInventory.ts';
import { ItemIds, createDefaultItemRegistry } from '../src/items/ItemRegistry.ts';
import { createStack, damageTool, remainingDurability } from '../src/items/ItemStack.ts';
import { breakDurationFor, miningSpeedFor } from '../src/items/ToolLogic.ts';
import { createDefaultBlockRegistry, BlockIds } from '../src/blocks/BlockRegistry.ts';

const items = createDefaultItemRegistry();
const recipes = createDefaultCraftingRegistry(items);

test('default item registry maps block items and tools', () => {
  assert.equal(items.size, 14);
  assert.equal(items.get(ItemIds.DIRT).maxStack, 64);
  assert.equal(items.get(ItemIds.WOODEN_PICKAXE).maxStack, 1);
  assert.equal(items.get(ItemIds.WOODEN_PICKAXE).tool?.maxDurability, 59);
});

test('item stack enforces stack limits and tool durability', () => {
  assert.throws(() => createStack(items, ItemIds.DIRT, 65), RangeError);
  assert.throws(() => createStack(items, ItemIds.WOODEN_PICKAXE, 2), RangeError);
  const tool = createStack(items, ItemIds.WOODEN_PICKAXE);
  assert.equal(remainingDurability(tool, items), 59);
  const damaged = damageTool(tool, items, 58);
  assert.equal(damaged?.damage, 58);
  assert.equal(remainingDurability(damaged!, items), 1);
  assert.equal(damageTool(damaged!, items, 1), null);
});

test('matching tools accelerate preferred blocks while wrong tools do not', () => {
  const blocks = createDefaultBlockRegistry();
  const stone = blocks.get(BlockIds.STONE);
  const wood = blocks.get(BlockIds.WOOD);
  const pickaxe = items.get(ItemIds.WOODEN_PICKAXE);
  assert.equal(miningSpeedFor(stone, pickaxe), 2);
  assert.equal(miningSpeedFor(wood, pickaxe), 1);
  assert.equal(breakDurationFor(stone, pickaxe), 0.75);
});

test('inventory merges stacks then uses empty slots', () => {
  const inventory = new Inventory(2);
  inventory.set(0, createStack(items, ItemIds.DIRT, 60), items);
  const remainder = inventory.insert(createStack(items, ItemIds.DIRT, 10), items);
  assert.equal(remainder, null);
  assert.equal(inventory.get(0)?.count, 64);
  assert.equal(inventory.get(1)?.count, 6);
});

test('shift click moves stacks between hotbar and main inventory', () => {
  const inventory = new PlayerInventory();
  inventory.set(0, createStack(items, ItemIds.WOOD, 8), items);
  assert.equal(inventory.shiftClick(0, items), true);
  assert.equal(inventory.get(0), null);
  assert.equal(inventory.get(9)?.count, 8);
  assert.equal(inventory.shiftClick(9, items), true);
  assert.equal(inventory.get(0)?.count, 8);
});

test('right-click style half pickup and one-item placement preserve counts', () => {
  const source = new Inventory(2);
  source.set(0, createStack(items, ItemIds.PLANKS, 9), items);
  const held = takeHalf(source, 0, items);
  assert.equal(held?.count, 5);
  assert.equal(source.get(0)?.count, 4);
  const remainder = placeOne(source, 1, held!, items);
  assert.equal(source.get(1)?.count, 1);
  assert.equal(remainder?.count, 4);
});

test('drag-style transfer swaps incompatible slots and merges compatible stacks', () => {
  const a = new Inventory(2);
  const b = new Inventory(2);
  a.set(0, createStack(items, ItemIds.WOOD, 8), items);
  b.set(0, createStack(items, ItemIds.DIRT, 3), items);
  assert.equal(transferStack(a, 0, b, 0, items), true);
  assert.equal(a.get(0)?.itemId, ItemIds.DIRT);
  assert.equal(b.get(0)?.itemId, ItemIds.WOOD);
  a.set(1, createStack(items, ItemIds.WOOD, 60), items);
  assert.equal(transferStack(b, 0, a, 1, items), true);
  assert.equal(a.get(1)?.count, 64);
  assert.equal(b.get(0)?.count, 4);
});

test('2x2 crafting converts one wood into four planks regardless of offset', () => {
  const grid = new CraftingGrid(2, 2);
  const inventory = new PlayerInventory();
  grid.set(3, createStack(items, ItemIds.WOOD), items);
  assert.equal(previewCraft(grid, recipes)?.itemId, ItemIds.PLANKS);
  const result = craftOnce(grid, inventory, items, recipes);
  assert.equal(result.crafted, true);
  assert.equal(inventory.countItem(ItemIds.PLANKS), 4);
  assert.equal(grid.get(3), null);
});

test('2x2 crafting creates a crafting table from four planks', () => {
  const grid = new CraftingGrid(2, 2);
  const inventory = new PlayerInventory();
  for (let i = 0; i < 4; i += 1) grid.set(i, createStack(items, ItemIds.PLANKS), items);
  assert.equal(previewCraft(grid, recipes)?.itemId, ItemIds.CRAFTING_TABLE);
  assert.equal(craftOnce(grid, inventory, items, recipes).crafted, true);
  assert.equal(inventory.countItem(ItemIds.CRAFTING_TABLE), 1);
});

test('3x3 crafting creates a wooden pickaxe but 2x2 cannot', () => {
  const grid = new CraftingGrid(3, 3);
  for (const index of [0, 1, 2]) grid.set(index, createStack(items, ItemIds.PLANKS), items);
  for (const index of [4, 7]) grid.set(index, createStack(items, ItemIds.STICK), items);
  assert.equal(previewCraft(grid, recipes)?.itemId, ItemIds.WOODEN_PICKAXE);

  const small = new CraftingGrid(2, 2);
  small.set(0, createStack(items, ItemIds.PLANKS), items);
  small.set(1, createStack(items, ItemIds.PLANKS), items);
  small.set(2, createStack(items, ItemIds.STICK), items);
  small.set(3, createStack(items, ItemIds.STICK), items);
  assert.notEqual(previewCraft(small, recipes)?.itemId, ItemIds.WOODEN_PICKAXE);
});

test('crafting does not consume ingredients when output cannot fit', () => {
  const grid = new CraftingGrid(2, 2);
  const inventory = new PlayerInventory();
  for (let i = 0; i < inventory.size; i += 1) inventory.set(i, createStack(items, ItemIds.DIRT, 64), items);
  grid.set(0, createStack(items, ItemIds.WOOD), items);
  const result = craftOnce(grid, inventory, items, recipes);
  assert.equal(result.crafted, false);
  assert.equal(grid.get(0)?.count, 1);
});

test('inventory capacity check protects crafting inputs from partial output loss', () => {
  const inventory = new PlayerInventory();
  for (let i = 0; i < inventory.size; i += 1) inventory.set(i, createStack(items, ItemIds.DIRT, 64), items);
  inventory.set(0, createStack(items, ItemIds.PLANKS, 63), items);
  assert.equal(inventory.canFullyInsert(createStack(items, ItemIds.PLANKS, 1), items), true);
  assert.equal(inventory.canFullyInsert(createStack(items, ItemIds.PLANKS, 2), items), false);
});
