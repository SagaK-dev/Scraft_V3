import { BlockIds } from '../blocks/BlockRegistry.ts';
import type { ItemDefinition } from './Item.ts';
import { validateItemDefinition } from './Item.ts';

export const ItemIds = {
  GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAVES: 6, GLASS: 7, PLANKS: 8, CRAFTING_TABLE: 9, FURNACE: 10, CHEST: 11,
  STICK: 100, WOODEN_PICKAXE: 101, WOODEN_AXE: 102, WOODEN_SHOVEL: 103, STONE_PICKAXE: 104, APPLE: 200,
} as const;

export class ItemRegistry {
  private readonly items = new Map<number, ItemDefinition>();
  private readonly blockItems = new Map<number, number>();
  register(item: ItemDefinition): this {
    validateItemDefinition(item);
    if (this.items.has(item.id)) throw new Error(`Item id ${item.id} is already registered.`);
    if (item.placeBlockId !== undefined && this.blockItems.has(item.placeBlockId)) throw new Error(`Block ${item.placeBlockId} already has an item mapping.`);
    const frozen = Object.freeze({ ...item, tool: item.tool ? Object.freeze({ ...item.tool }) : undefined, food: item.food ? Object.freeze({ ...item.food }) : undefined });
    this.items.set(item.id, frozen);
    if (item.placeBlockId !== undefined) this.blockItems.set(item.placeBlockId, item.id);
    return this;
  }
  get(id: number): ItemDefinition { const item = this.items.get(id); if (!item) throw new RangeError(`Unknown item id: ${id}.`); return item; }
  has(id: number): boolean { return this.items.has(id); }
  getItemIdForBlock(blockId: number): number | undefined { return this.blockItems.get(blockId); }
  get size(): number { return this.items.size; }
}

export function createDefaultItemRegistry(): ItemRegistry {
  return new ItemRegistry()
    .register({ id: ItemIds.GRASS, name: 'Grass Block', maxStack: 64, color: 0x6e9f45, placeBlockId: BlockIds.GRASS })
    .register({ id: ItemIds.DIRT, name: 'Dirt', maxStack: 64, color: 0x805a3b, placeBlockId: BlockIds.DIRT })
    .register({ id: ItemIds.STONE, name: 'Stone', maxStack: 64, color: 0x7d8284, placeBlockId: BlockIds.STONE })
    .register({ id: ItemIds.SAND, name: 'Sand', maxStack: 64, color: 0xd8c57d, placeBlockId: BlockIds.SAND })
    .register({ id: ItemIds.WOOD, name: 'Wood', maxStack: 64, color: 0x8a6038, placeBlockId: BlockIds.WOOD })
    .register({ id: ItemIds.LEAVES, name: 'Leaves', maxStack: 64, color: 0x4f7f43, placeBlockId: BlockIds.LEAVES })
    .register({ id: ItemIds.GLASS, name: 'Glass', maxStack: 64, color: 0xb7d6df, placeBlockId: BlockIds.GLASS })
    .register({ id: ItemIds.PLANKS, name: 'Wooden Planks', maxStack: 64, color: 0xb98752, placeBlockId: BlockIds.PLANKS })
    .register({ id: ItemIds.CRAFTING_TABLE, name: 'Crafting Table', maxStack: 64, color: 0x9b693d, placeBlockId: BlockIds.CRAFTING_TABLE })
    .register({ id: ItemIds.FURNACE, name: 'Furnace', maxStack: 64, color: 0x696d70, placeBlockId: BlockIds.FURNACE })
    .register({ id: ItemIds.CHEST, name: 'Chest', maxStack: 64, color: 0xa8733f, placeBlockId: BlockIds.CHEST })
    .register({ id: ItemIds.STICK, name: 'Stick', maxStack: 64, color: 0x9c7148 })
    .register({ id: ItemIds.WOODEN_PICKAXE, name: 'Wooden Pickaxe', maxStack: 1, color: 0xb98752, tool: { kind: 'pickaxe', tier: 0, speed: 2, maxDurability: 59 } })
    .register({ id: ItemIds.WOODEN_AXE, name: 'Wooden Axe', maxStack: 1, color: 0xb98752, tool: { kind: 'axe', tier: 0, speed: 2, maxDurability: 59 } })
    .register({ id: ItemIds.WOODEN_SHOVEL, name: 'Wooden Shovel', maxStack: 1, color: 0xb98752, tool: { kind: 'shovel', tier: 0, speed: 2, maxDurability: 59 } })
    .register({ id: ItemIds.STONE_PICKAXE, name: 'Stone Pickaxe', maxStack: 1, color: 0x858585, tool: { kind: 'pickaxe', tier: 1, speed: 4, maxDurability: 131 } })
    .register({ id: ItemIds.APPLE, name: 'Apple', maxStack: 64, color: 0xd94c3f, food: { hunger: 4, saturation: 2.4 } });
}
