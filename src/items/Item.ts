export type ToolKind = 'pickaxe' | 'axe' | 'shovel';

export interface ToolDefinition {
  readonly kind: ToolKind;
  readonly tier: number;
  readonly speed: number;
  readonly maxDurability: number;
}

export interface ItemDefinition {
  readonly id: number;
  readonly name: string;
  readonly maxStack: number;
  readonly color: number;
  readonly placeBlockId?: number;
  readonly tool?: ToolDefinition;
}

export const MAX_ITEM_ID = 0xffff;

export function validateItemDefinition(item: ItemDefinition): void {
  if (!Number.isInteger(item.id) || item.id <= 0 || item.id > MAX_ITEM_ID) {
    throw new RangeError(`Item id must be an integer from 1 to ${MAX_ITEM_ID}.`);
  }
  if (item.name.trim().length === 0) throw new TypeError('Item name must not be empty.');
  if (!Number.isInteger(item.maxStack) || item.maxStack < 1 || item.maxStack > 64) {
    throw new RangeError('Item maxStack must be an integer from 1 to 64.');
  }
  if (!Number.isInteger(item.color) || item.color < 0 || item.color > 0xffffff) {
    throw new RangeError('Item color must be a 24-bit RGB integer.');
  }
  if (item.placeBlockId !== undefined && (!Number.isInteger(item.placeBlockId) || item.placeBlockId < 1)) {
    throw new RangeError('placeBlockId must be a positive integer when provided.');
  }
  if (item.tool) {
    if (item.maxStack !== 1) throw new RangeError('Tools must have maxStack 1.');
    if (!Number.isInteger(item.tool.tier) || item.tool.tier < 0) throw new RangeError('Tool tier must be a non-negative integer.');
    if (!Number.isFinite(item.tool.speed) || item.tool.speed <= 0) throw new RangeError('Tool speed must be positive.');
    if (!Number.isInteger(item.tool.maxDurability) || item.tool.maxDurability < 1) throw new RangeError('Tool durability must be a positive integer.');
  }
}
