import { CHUNK_HEIGHT, CHUNK_SIZE } from './coordinates.ts';

const VOXEL_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

export class Chunk {
  readonly x: number;
  readonly z: number;
  readonly voxels = new Uint16Array(VOXEL_COUNT);
  private lowestFilledY = CHUNK_HEIGHT;
  private highestFilledY = -1;

  constructor(x: number, z: number) {
    if (!Number.isInteger(x) || !Number.isInteger(z)) throw new TypeError('Chunk coordinates must be integers.');
    this.x = x;
    this.z = z;
  }

  get(localX: number, localY: number, localZ: number): number {
    return this.voxels[this.index(localX, localY, localZ)] ?? 0;
  }

  set(localX: number, localY: number, localZ: number, blockId: number): boolean {
    if (!Number.isInteger(blockId) || blockId < 0 || blockId > 0xffff) {
      throw new RangeError('Chunk block id must fit in Uint16.');
    }
    const index = this.index(localX, localY, localZ);
    const previous = this.voxels[index] ?? 0;
    if (previous === blockId) return false;
    this.voxels[index] = blockId;

    if (blockId !== 0) {
      this.lowestFilledY = Math.min(this.lowestFilledY, localY);
      this.highestFilledY = Math.max(this.highestFilledY, localY);
    } else if (previous !== 0 && (localY === this.lowestFilledY || localY === this.highestFilledY)) {
      this.recalculateVerticalBounds();
    }
    return true;
  }

  get minFilledY(): number {
    return this.lowestFilledY;
  }

  get maxFilledY(): number {
    return this.highestFilledY;
  }

  get empty(): boolean {
    return this.highestFilledY < this.lowestFilledY;
  }

  private index(localX: number, localY: number, localZ: number): number {
    if (!Number.isInteger(localX) || !Number.isInteger(localY) || !Number.isInteger(localZ)) {
      throw new TypeError('Local voxel coordinates must be integers.');
    }
    if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE || localY < 0 || localY >= CHUNK_HEIGHT) {
      throw new RangeError(`Local voxel coordinate is outside ${CHUNK_SIZE}x${CHUNK_HEIGHT}x${CHUNK_SIZE}.`);
    }
    return localY * CHUNK_SIZE * CHUNK_SIZE + localZ * CHUNK_SIZE + localX;
  }

  private recalculateVerticalBounds(): void {
    let low = CHUNK_HEIGHT;
    let high = -1;
    const layerSize = CHUNK_SIZE * CHUNK_SIZE;
    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      const start = y * layerSize;
      let occupied = false;
      for (let i = 0; i < layerSize; i += 1) {
        if ((this.voxels[start + i] ?? 0) !== 0) {
          occupied = true;
          break;
        }
      }
      if (occupied) {
        low = Math.min(low, y);
        high = y;
      }
    }
    this.lowestFilledY = low;
    this.highestFilledY = high;
  }
}
