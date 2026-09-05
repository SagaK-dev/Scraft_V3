import { Chunk } from './Chunk.ts';
import { chunkKey } from './ChunkManager.ts';
import { CHUNK_MAX_Y, CHUNK_MIN_Y, CHUNK_SIZE, splitCoordinate, worldYToLocal } from './coordinates.ts';

export class WorldEditStore {
  private readonly edits = new Map<string, Map<number, number>>();

  record(worldX: number, worldY: number, worldZ: number, blockId: number): void {
    if (!Number.isInteger(worldX) || !Number.isInteger(worldY) || !Number.isInteger(worldZ)) {
      throw new TypeError('World edit coordinates must be integers.');
    }
    if (!Number.isInteger(blockId) || blockId < 0 || blockId > 0xffff) throw new RangeError('World edit block id must fit in Uint16.');
    if (worldY < CHUNK_MIN_Y || worldY > CHUNK_MAX_Y) return;

    const x = splitCoordinate(worldX);
    const z = splitCoordinate(worldZ);
    const key = chunkKey(x.chunk, z.chunk);
    let chunkEdits = this.edits.get(key);
    if (!chunkEdits) {
      chunkEdits = new Map<number, number>();
      this.edits.set(key, chunkEdits);
    }
    chunkEdits.set(localIndex(x.local, worldYToLocal(worldY), z.local), blockId);
  }

  applyToChunk(chunk: Chunk): number {
    const chunkEdits = this.edits.get(chunkKey(chunk.x, chunk.z));
    if (!chunkEdits) return 0;
    let applied = 0;
    for (const [index, blockId] of chunkEdits) {
      const localY = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
      const remainder = index - localY * CHUNK_SIZE * CHUNK_SIZE;
      const localZ = Math.floor(remainder / CHUNK_SIZE);
      const localX = remainder - localZ * CHUNK_SIZE;
      chunk.set(localX, localY, localZ, blockId);
      applied += 1;
    }
    return applied;
  }

  get size(): number {
    let count = 0;
    for (const chunkEdits of this.edits.values()) count += chunkEdits.size;
    return count;
  }
}

function localIndex(localX: number, localY: number, localZ: number): number {
  return localY * CHUNK_SIZE * CHUNK_SIZE + localZ * CHUNK_SIZE + localX;
}
