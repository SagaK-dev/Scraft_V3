import { BlockIds } from '../blocks/BlockRegistry.ts';
import { Chunk } from './Chunk.ts';
import { CHUNK_MAX_Y, CHUNK_MIN_Y, CHUNK_SIZE, worldYToLocal } from './coordinates.ts';
import { fbm2D, ridgedFbm2D, seedToUint32 } from './SeededNoise.ts';

export interface TerrainSample {
  readonly height: number;
  readonly surfaceBlockId: number;
  readonly continentalness: number;
  readonly ruggedness: number;
}

export class WorldGenerator {
  readonly seed: string;
  readonly numericSeed: number;

  constructor(seed: string) {
    this.seed = seed;
    this.numericSeed = seedToUint32(seed);
  }

  sampleTerrain(worldX: number, worldZ: number): TerrainSample {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) throw new RangeError('Terrain coordinates must be finite.');

    const warpX = fbm2D(worldX * 0.0019, worldZ * 0.0019, this.numericSeed ^ 0x68bc21eb, 4) * 54;
    const warpZ = fbm2D(worldX * 0.0019 + 31.7, worldZ * 0.0019 - 19.4, this.numericSeed ^ 0x02e5be93, 4) * 54;
    const x = worldX + warpX;
    const z = worldZ + warpZ;

    const continentalness = fbm2D(x * 0.00125, z * 0.00125, this.numericSeed ^ 0xa511e9b3, 5);
    const hills = fbm2D(x * 0.0065, z * 0.0065, this.numericSeed ^ 0x63d83595, 5);
    const ridges = ridgedFbm2D(x * 0.0031, z * 0.0031, this.numericSeed ^ 0xb5297a4d, 5);
    const mountainMask = Math.max(0, (continentalness + 0.08) * 1.15);
    const mountain = Math.max(0, ridges - 0.5) * 160 * mountainMask;

    let height = -4 + continentalness * 11 + hills * 7 + mountain;
    height = Math.round(Math.min(CHUNK_MAX_Y - 8, Math.max(CHUNK_MIN_Y + 4, height)));

    const aridity = fbm2D(x * 0.0038 + 71, z * 0.0038 - 43, this.numericSeed ^ 0x9e3779b9, 4);
    const steepOrHigh = height > 34 && ridges > 0.7;
    const sandy = aridity > 0.56 || height <= -7;
    const surfaceBlockId = steepOrHigh ? BlockIds.STONE : sandy ? BlockIds.SAND : BlockIds.GRASS;

    return { height, surfaceBlockId, continentalness, ruggedness: ridges };
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) throw new TypeError('Chunk coordinates must be integers.');
    const chunk = new Chunk(chunkX, chunkZ);
    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;

    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const sample = this.sampleTerrain(originX + localX, originZ + localZ);
        const topY = sample.height;
        const filler = sample.surfaceBlockId === BlockIds.SAND ? BlockIds.SAND : BlockIds.DIRT;
        for (let worldY = CHUNK_MIN_Y; worldY <= topY; worldY += 1) {
          const depth = topY - worldY;
          const blockId = depth === 0 ? sample.surfaceBlockId : depth <= 3 ? filler : BlockIds.STONE;
          chunk.set(localX, worldYToLocal(worldY), localZ, blockId);
        }
      }
    }
    return chunk;
  }
}
