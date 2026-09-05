import type { BlockRegistry } from '../blocks/BlockRegistry.ts';
import type { Chunk } from './Chunk.ts';
import type { ChunkManager } from './ChunkManager.ts';
import { CHUNK_MAX_Y, CHUNK_MIN_Y, CHUNK_SIZE, localYToWorld, splitCoordinate } from './coordinates.ts';

export interface LightLevels {
  readonly sky: number;
  readonly block: number;
  readonly brightness: number;
}

export interface ChunkLighting {
  sample(worldX: number, worldY: number, worldZ: number): number;
  sampleLevels(worldX: number, worldY: number, worldZ: number): LightLevels;
}

interface EmissiveSource {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly level: number;
}

interface LightNode extends EmissiveSource {}

const MIN_AMBIENT = 0.16;
const SKY_WEIGHT = 0.74;
const BLOCK_WEIGHT = 0.9;

export class LightEngine {
  private sourceCache = new WeakMap<Chunk, readonly EmissiveSource[]>();
  private readonly chunks: ChunkManager;
  private readonly blocks: BlockRegistry;

  constructor(chunks: ChunkManager, blocks: BlockRegistry) {
    this.chunks = chunks;
    this.blocks = blocks;
  }

  buildChunkLighting(chunkX: number, chunkZ: number): ChunkLighting {
    if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) throw new TypeError('Chunk coordinates must be integers.');
    const minX = chunkX * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const minZ = chunkZ * CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE - 1;
    const blockLight = new Map<string, number>();
    const skyTopCache = new Map<string, number>();

    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const sourceChunk = this.chunks.getChunk(chunkX + dx, chunkZ + dz);
        if (!sourceChunk) continue;
        for (const source of this.sourcesForChunk(sourceChunk)) {
          if (horizontalDistanceToRect(source.x, source.z, minX, maxX, minZ, maxZ) > source.level + 1) continue;
          this.propagateSource(source, blockLight, minX, maxX, minZ, maxZ);
        }
      }
    }

    const sampleLevels = (worldX: number, worldY: number, worldZ: number): LightLevels => {
      if (![worldX, worldY, worldZ].every(Number.isInteger)) throw new TypeError('Light sample coordinates must be integers.');
      const top = this.topOpaqueY(worldX, worldZ, skyTopCache);
      const sky = worldY > top ? 15 : 2;
      const block = blockLight.get(lightKey(worldX, worldY, worldZ)) ?? 0;
      const brightness = Math.min(1.45, Math.max(MIN_AMBIENT, MIN_AMBIENT + (sky / 15) * SKY_WEIGHT + (block / 15) * BLOCK_WEIGHT));
      return { sky, block, brightness };
    };

    return {
      sample: (worldX, worldY, worldZ) => sampleLevels(worldX, worldY, worldZ).brightness,
      sampleLevels,
    };
  }

  invalidateChunkSources(chunkX: number, chunkZ: number): void {
    const chunk = this.chunks.getChunk(chunkX, chunkZ);
    if (chunk) this.sourceCache.delete(chunk);
  }

  clearCaches(): void {
    this.sourceCache = new WeakMap<Chunk, readonly EmissiveSource[]>();
  }

  private sourcesForChunk(chunk: Chunk): readonly EmissiveSource[] {
    const cached = this.sourceCache.get(chunk);
    if (cached) return cached;
    const sources: EmissiveSource[] = [];
    if (!chunk.empty) {
      const originX = chunk.x * CHUNK_SIZE;
      const originZ = chunk.z * CHUNK_SIZE;
      for (let localY = chunk.minFilledY; localY <= chunk.maxFilledY; localY += 1) {
        const worldY = localYToWorld(localY);
        for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
          for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
            const block = this.blocks.get(chunk.get(localX, localY, localZ));
            const level = block.lightLevel ?? 0;
            if (level <= 0) continue;
            sources.push({ x: originX + localX, y: worldY, z: originZ + localZ, level });
          }
        }
      }
    }
    const frozen = Object.freeze(sources.map(source => Object.freeze(source)));
    this.sourceCache.set(chunk, frozen);
    return frozen;
  }

  private propagateSource(source: EmissiveSource, output: Map<string, number>, minX: number, maxX: number, minZ: number, maxZ: number): void {
    const queue: LightNode[] = [source];
    const visited = new Map<string, number>([[lightKey(source.x, source.y, source.z), source.level]]);
    let index = 0;
    while (index < queue.length) {
      const node = queue[index++];
      if (!node) continue;
      if (node.x >= minX - 1 && node.x <= maxX + 1 && node.z >= minZ - 1 && node.z <= maxZ + 1) {
        const key = lightKey(node.x, node.y, node.z);
        if ((output.get(key) ?? 0) < node.level) output.set(key, node.level);
      }
      if (node.level <= 1) continue;
      for (const [dx, dy, dz] of DIRECTIONS) {
        const x = node.x + dx;
        const y = node.y + dy;
        const z = node.z + dz;
        if (y < CHUNK_MIN_Y || y > CHUNK_MAX_Y) continue;
        if (x < minX - source.level - 1 || x > maxX + source.level + 1 || z < minZ - source.level - 1 || z > maxZ + source.level + 1) continue;
        const block = this.blocks.get(this.chunks.getBlock(x, y, z));
        if (block.opaque && (block.lightLevel ?? 0) <= 0) continue;
        const attenuation = block.liquid ? 2 : 1;
        const level = node.level - attenuation;
        if (level <= 0) continue;
        const key = lightKey(x, y, z);
        if ((visited.get(key) ?? -1) >= level) continue;
        visited.set(key, level);
        queue.push({ x, y, z, level });
      }
    }
  }

  private topOpaqueY(worldX: number, worldZ: number, cache: Map<string, number>): number {
    const columnKey = `${worldX},${worldZ}`;
    const cached = cache.get(columnKey);
    if (cached !== undefined) return cached;
    const splitX = splitCoordinate(worldX);
    const splitZ = splitCoordinate(worldZ);
    const chunk = this.chunks.getChunk(splitX.chunk, splitZ.chunk);
    if (!chunk || chunk.empty) {
      cache.set(columnKey, CHUNK_MIN_Y - 1);
      return CHUNK_MIN_Y - 1;
    }
    for (let localY = chunk.maxFilledY; localY >= chunk.minFilledY; localY -= 1) {
      const id = chunk.get(splitX.local, localY, splitZ.local);
      if (this.blocks.get(id).opaque) {
        const worldY = localYToWorld(localY);
        cache.set(columnKey, worldY);
        return worldY;
      }
    }
    cache.set(columnKey, CHUNK_MIN_Y - 1);
    return CHUNK_MIN_Y - 1;
  }
}

const DIRECTIONS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
] as const;

function lightKey(x: number, y: number, z: number): string { return `${x},${y},${z}`; }

function horizontalDistanceToRect(x: number, z: number, minX: number, maxX: number, minZ: number, maxZ: number): number {
  const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
  const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
  return dx + dz;
}
