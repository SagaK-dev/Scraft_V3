import type { BlockDefinition } from './Block.ts';
import { validateBlockDefinition } from './Block.ts';

export const BlockIds = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  GLASS: 7,
  PLANKS: 8,
  CRAFTING_TABLE: 9,
  FURNACE: 10,
  CHEST: 11,
} as const;

export class BlockRegistry {
  private readonly blocks = new Map<number, BlockDefinition>();
  register(block: BlockDefinition): this { validateBlockDefinition(block); if (this.blocks.has(block.id)) throw new Error(`Block id ${block.id} is already registered.`); this.blocks.set(block.id, Object.freeze({ ...block })); return this; }
  has(id: number): boolean { return this.blocks.has(id); }
  get(id: number): BlockDefinition { const block = this.blocks.get(id); if (!block) throw new RangeError(`Unknown block id: ${id}.`); return block; }
  isAir(id: number): boolean { return id === BlockIds.AIR; }
  get size(): number { return this.blocks.size; }
}

export function createDefaultBlockRegistry(): BlockRegistry {
  return new BlockRegistry()
    .register({ id: BlockIds.AIR, name: 'Air', solid: false, opaque: false, hardness: 0, color: 0x000000, placeable: false })
    .register({ id: BlockIds.GRASS, name: 'Grass', solid: true, opaque: true, hardness: 0.6, color: 0x6e9f45, placeable: true, preferredTool: 'shovel' })
    .register({ id: BlockIds.DIRT, name: 'Dirt', solid: true, opaque: true, hardness: 0.5, color: 0x805a3b, placeable: true, preferredTool: 'shovel' })
    .register({ id: BlockIds.STONE, name: 'Stone', solid: true, opaque: true, hardness: 1.5, color: 0x7d8284, placeable: true, preferredTool: 'pickaxe' })
    .register({ id: BlockIds.SAND, name: 'Sand', solid: true, opaque: true, hardness: 0.5, color: 0xd8c57d, placeable: true, preferredTool: 'shovel' })
    .register({ id: BlockIds.WOOD, name: 'Wood', solid: true, opaque: true, hardness: 2.0, color: 0x8a6038, placeable: true, preferredTool: 'axe' })
    .register({ id: BlockIds.LEAVES, name: 'Leaves', solid: true, opaque: false, hardness: 0.3, color: 0x4f7f43, placeable: true, preferredTool: 'axe' })
    .register({ id: BlockIds.GLASS, name: 'Glass', solid: true, opaque: false, hardness: 0.3, color: 0xb7d6df, placeable: true })
    .register({ id: BlockIds.PLANKS, name: 'Wooden Planks', solid: true, opaque: true, hardness: 2.0, color: 0xb98752, placeable: true, preferredTool: 'axe' })
    .register({ id: BlockIds.CRAFTING_TABLE, name: 'Crafting Table', solid: true, opaque: true, hardness: 2.5, color: 0x9b693d, placeable: true, preferredTool: 'axe' })
    .register({ id: BlockIds.FURNACE, name: 'Furnace', solid: true, opaque: true, hardness: 3.5, color: 0x696d70, placeable: true, preferredTool: 'pickaxe' })
    .register({ id: BlockIds.CHEST, name: 'Chest', solid: true, opaque: true, hardness: 2.5, color: 0xa8733f, placeable: true, preferredTool: 'axe' });
}
