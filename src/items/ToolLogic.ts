import type { BlockDefinition } from '../blocks/Block.ts';
import type { ItemDefinition } from './Item.ts';

export function miningSpeedFor(block: BlockDefinition, item: ItemDefinition | null): number {
  const tool = item?.tool;
  if (!tool || block.preferredTool !== tool.kind) return 1;
  return tool.speed;
}

export function breakDurationFor(block: BlockDefinition, item: ItemDefinition | null): number {
  if (block.hardness <= 0) return 0;
  return Math.max(0.05, block.hardness / miningSpeedFor(block, item));
}
