import { BlockIds } from '../blocks/BlockRegistry.ts';
import { Chunk } from './Chunk.ts';
import { CHUNK_MAX_Y, CHUNK_MIN_Y, CHUNK_SIZE, splitCoordinate, worldYToLocal } from './coordinates.ts';

export interface BlockChangeResult {
  readonly changed: boolean;
  readonly affectedChunkKeys: readonly string[];
}

export function chunkKey(x: number, z: number): string {
  return `${x},${z}`;
}

export class ChunkManager {
  private readonly chunks = new Map<string, Chunk>();
  private readonly dirty = new Set<string>();

  add(chunk: Chunk): void {
    const key = chunkKey(chunk.x, chunk.z);
    const previous = this.chunks.get(key);
    if (previous === chunk) return;
    this.chunks.set(key, chunk);
    this.markDirtyWithNeighbors(chunk.x, chunk.z);
  }

  remove(chunkX: number, chunkZ: number): Chunk | undefined {
    const key = chunkKey(chunkX, chunkZ);
    const removed = this.chunks.get(key);
    if (!removed) return undefined;
    this.chunks.delete(key);
    this.markDirtyWithNeighbors(chunkX, chunkZ);
    return removed;
  }

  getChunk(chunkX: number, chunkZ: number): Chunk | undefined {
    return this.chunks.get(chunkKey(chunkX, chunkZ));
  }

  hasChunk(chunkX: number, chunkZ: number): boolean {
    return this.chunks.has(chunkKey(chunkX, chunkZ));
  }

  getBlock(worldX: number, worldY: number, worldZ: number): number {
    if (!Number.isInteger(worldX) || !Number.isInteger(worldY) || !Number.isInteger(worldZ)) {
      throw new TypeError('World block coordinates must be integers.');
    }
    if (worldY < CHUNK_MIN_Y || worldY > CHUNK_MAX_Y) return BlockIds.AIR;
    const x = splitCoordinate(worldX);
    const z = splitCoordinate(worldZ);
    const chunk = this.getChunk(x.chunk, z.chunk);
    if (!chunk) return BlockIds.AIR;
    return chunk.get(x.local, worldYToLocal(worldY), z.local);
  }

  setBlock(worldX: number, worldY: number, worldZ: number, blockId: number): BlockChangeResult {
    if (!Number.isInteger(worldX) || !Number.isInteger(worldY) || !Number.isInteger(worldZ)) {
      throw new TypeError('World block coordinates must be integers.');
    }
    if (worldY < CHUNK_MIN_Y || worldY > CHUNK_MAX_Y) return { changed: false, affectedChunkKeys: [] };

    const x = splitCoordinate(worldX);
    const z = splitCoordinate(worldZ);
    const chunk = this.getChunk(x.chunk, z.chunk);
    if (!chunk) return { changed: false, affectedChunkKeys: [] };
    if (!chunk.set(x.local, worldYToLocal(worldY), z.local, blockId)) return { changed: false, affectedChunkKeys: [] };

    const affected = new Set<string>();
    this.markDirty(x.chunk, z.chunk, affected);
    if (x.local === 0) this.markDirty(x.chunk - 1, z.chunk, affected);
    if (x.local === CHUNK_SIZE - 1) this.markDirty(x.chunk + 1, z.chunk, affected);
    if (z.local === 0) this.markDirty(x.chunk, z.chunk - 1, affected);
    if (z.local === CHUNK_SIZE - 1) this.markDirty(x.chunk, z.chunk + 1, affected);
    return { changed: true, affectedChunkKeys: [...affected] };
  }

  takeDirtyChunkKeys(): string[] {
    const keys = [...this.dirty];
    this.dirty.clear();
    return keys;
  }

  markAllDirty(): void {
    for (const chunk of this.chunks.values()) this.dirty.add(chunkKey(chunk.x, chunk.z));
  }

  values(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  get size(): number {
    return this.chunks.size;
  }

  private markDirtyWithNeighbors(chunkX: number, chunkZ: number): void {
    this.dirty.add(chunkKey(chunkX, chunkZ));
    this.dirty.add(chunkKey(chunkX - 1, chunkZ));
    this.dirty.add(chunkKey(chunkX + 1, chunkZ));
    this.dirty.add(chunkKey(chunkX, chunkZ - 1));
    this.dirty.add(chunkKey(chunkX, chunkZ + 1));
  }

  private markDirty(chunkX: number, chunkZ: number, affected: Set<string>): void {
    const key = chunkKey(chunkX, chunkZ);
    if (!this.chunks.has(key)) return;
    this.dirty.add(key);
    affected.add(key);
  }
}
