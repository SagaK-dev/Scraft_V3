export type BlockToolKind = 'pickaxe' | 'axe' | 'shovel';

export interface BlockDefinition {
  readonly id: number;
  readonly name: string;
  readonly solid: boolean;
  readonly opaque: boolean;
  readonly hardness: number;
  readonly color: number;
  readonly placeable: boolean;
  readonly preferredTool?: BlockToolKind;
  /** Render this block in the translucent pass. */
  readonly translucent?: boolean;
  /** Fluid blocks do not collide with the player and are ignored by normal block raycasts. */
  readonly liquid?: boolean;
  /** Replaceable blocks can be overwritten by normal block placement. */
  readonly replaceable?: boolean;
  /** Static block-light emission from 0 to 15. */
  readonly lightLevel?: number;
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
  if (block.lightLevel !== undefined && (!Number.isInteger(block.lightLevel) || block.lightLevel < 0 || block.lightLevel > 15)) {
    throw new RangeError('Block lightLevel must be an integer from 0 to 15.');
  }
  if (block.translucent && block.opaque) throw new TypeError('A translucent block cannot be opaque.');
  if (block.liquid && block.solid) throw new TypeError('A liquid block cannot be solid.');
}
