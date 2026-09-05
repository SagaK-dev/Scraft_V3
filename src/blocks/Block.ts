export interface BlockDefinition {
  readonly id: number;
  readonly name: string;
  readonly solid: boolean;
  readonly opaque: boolean;
  readonly hardness: number;
  readonly color: number;
  readonly placeable: boolean;
}

export const MAX_BLOCK_ID = 0xffff;

export function validateBlockDefinition(block: BlockDefinition): void {
  if (!Number.isInteger(block.id) || block.id < 0 || block.id > MAX_BLOCK_ID) {
    throw new RangeError(`Block id must be an integer from 0 to ${MAX_BLOCK_ID}.`);
  }
  if (block.name.trim().length === 0) throw new TypeError('Block name must not be empty.');
  if (!Number.isFinite(block.hardness) || block.hardness < 0) {
    throw new RangeError('Block hardness must be a finite non-negative number.');
  }
  if (!Number.isInteger(block.color) || block.color < 0 || block.color > 0xffffff) {
    throw new RangeError('Block color must be a 24-bit RGB integer.');
  }
}
