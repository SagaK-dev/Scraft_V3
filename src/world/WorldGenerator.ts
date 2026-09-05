import { BlockIds } from '../blocks/BlockRegistry.ts';
import { sampleBiome, type BiomeKind } from './Biome.ts';
import { Chunk } from './Chunk.ts';
import { CHUNK_MAX_Y, CHUNK_MIN_Y, CHUNK_SIZE, worldYToLocal } from './coordinates.ts';
import { deterministicUnit2D, deterministicUnit3D, fbm2D, fbm3D, ridgedFbm2D, seedToUint32 } from './SeededNoise.ts';

export const SEA_LEVEL = -2;

export interface TerrainSample {
  readonly height: number;
  readonly surfaceBlockId: number;
  readonly continentalness: number;
  readonly ruggedness: number;
  readonly biome: BiomeKind;
  readonly temperature: number;
  readonly moisture: number;
}

interface FeatureAnchor {
  readonly x: number;
  readonly z: number;
  readonly kind: 'tree' | 'shrub' | 'ruin';
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
    height = Math.round(Math.min(CHUNK_MAX_Y - 12, Math.max(CHUNK_MIN_Y + 5, height)));

    const climate = sampleBiome(worldX, worldZ, height, this.numericSeed);
    let surfaceBlockId: number = BlockIds.GRASS;
    if (climate.kind === 'desert') surfaceBlockId = BlockIds.SAND;
    else if (climate.kind === 'alpine') surfaceBlockId = height > 45 || climate.temperature < -0.72 ? BlockIds.SNOW : BlockIds.STONE;
    else if (height > 38 && ridges > 0.73) surfaceBlockId = BlockIds.STONE;
    return {
      height,
      surfaceBlockId,
      continentalness,
      ruggedness: ridges,
      biome: climate.kind,
      temperature: climate.temperature,
      moisture: climate.moisture,
    };
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) throw new TypeError('Chunk coordinates must be integers.');
    const chunk = new Chunk(chunkX, chunkZ);
    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const worldX = originX + localX;
        const worldZ = originZ + localZ;
        const sample = this.sampleTerrain(worldX, worldZ);
        const filler = sample.surfaceBlockId === BlockIds.SAND ? BlockIds.SAND : sample.surfaceBlockId === BlockIds.SNOW ? BlockIds.STONE : BlockIds.DIRT;
        for (let worldY = CHUNK_MIN_Y; worldY <= sample.height; worldY += 1) {
          const depth = sample.height - worldY;
          let blockId = depth === 0 ? sample.surfaceBlockId : depth <= 3 ? filler : BlockIds.STONE;
          if (depth > 3 && this.isCave(worldX, worldY, worldZ, sample.height)) blockId = BlockIds.AIR;
          else if (blockId === BlockIds.STONE) blockId = this.oreAt(worldX, worldY, worldZ);
          chunk.set(localX, worldYToLocal(worldY), localZ, blockId);
        }
        if (sample.height < SEA_LEVEL) {
          for (let worldY = sample.height + 1; worldY <= SEA_LEVEL; worldY += 1) chunk.set(localX, worldYToLocal(worldY), localZ, BlockIds.WATER);
        }
      }
    }
    for (const anchor of this.featureAnchorsForChunk(chunkX, chunkZ)) this.stampFeature(chunk, anchor);
    return chunk;
  }

  private isCave(x: number, y: number, z: number, surfaceY: number): boolean {
    if (y >= surfaceY - 4 || y <= CHUNK_MIN_Y + 3) return false;
    const primary = fbm3D(x * 0.035, y * 0.045, z * 0.035, this.numericSeed ^ 0x71d67fff, 4);
    const tunnel = Math.abs(fbm3D(x * 0.018 + 17, y * 0.024 - 11, z * 0.018 + 29, this.numericSeed ^ 0x36f1a2c9, 3));
    const depthBoost = Math.min(0.12, Math.max(0, (surfaceY - y - 8) * 0.0025));
    return primary > 0.49 - depthBoost && tunnel < 0.44;
  }

  private oreAt(x: number, y: number, z: number): number {
    const depth = Math.max(0, SEA_LEVEL - y);
    const glow = fbm3D(x * 0.075, y * 0.075, z * 0.075, this.numericSeed ^ 0xc2b2ae35, 3);
    if (y < -22 && glow > 0.8) return BlockIds.GLOW_CRYSTAL;
    const iron = fbm3D(x * 0.082 + 31, y * 0.082, z * 0.082 - 19, this.numericSeed ^ 0x27d4eb2f, 3);
    if (y < 22 && iron + Math.min(0.06, depth * 0.0015) > 0.72) return BlockIds.IRON_ORE;
    const coal = fbm3D(x * 0.09 - 13, y * 0.09 + 7, z * 0.09 + 23, this.numericSeed ^ 0x165667b1, 3);
    if (y < 48 && coal > 0.68) return BlockIds.COAL_ORE;
    return BlockIds.STONE;
  }

  private featureAnchorsForChunk(chunkX: number, chunkZ: number): FeatureAnchor[] {
    const anchors: FeatureAnchor[] = [];
    const minX = chunkX * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const minZ = chunkZ * CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE - 1;
    const cellSize = 8;
    const minCellX = Math.floor((minX - 8) / cellSize);
    const maxCellX = Math.floor((maxX + 8) / cellSize);
    const minCellZ = Math.floor((minZ - 8) / cellSize);
    const maxCellZ = Math.floor((maxZ + 8) / cellSize);
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const ax = cellX * cellSize + Math.floor(deterministicUnit2D(cellX, cellZ, this.numericSeed, 0x4f7a11) * cellSize);
        const az = cellZ * cellSize + Math.floor(deterministicUnit2D(cellX, cellZ, this.numericSeed, 0x7c159e) * cellSize);
        const terrain = this.sampleTerrain(ax, az);
        if (terrain.height <= SEA_LEVEL) continue;
        const chance = terrain.biome === 'forest' ? 0.23 : terrain.biome === 'plains' ? 0.07 : terrain.biome === 'alpine' ? 0.015 : 0;
        const shrubChance = terrain.biome === 'forest' ? 0.12 : terrain.biome === 'plains' ? 0.08 : terrain.biome === 'alpine' ? 0.025 : 0.02;
        const roll = deterministicUnit2D(cellX, cellZ, this.numericSeed, 0x9e3779b9);
        if (roll < chance) anchors.push({ x: ax, z: az, kind: 'tree' });
        else if (roll < chance + shrubChance) anchors.push({ x: ax, z: az, kind: 'shrub' });
      }
    }
    const ruinCellSize = 48;
    const minRX = Math.floor((minX - 10) / ruinCellSize);
    const maxRX = Math.floor((maxX + 10) / ruinCellSize);
    const minRZ = Math.floor((minZ - 10) / ruinCellSize);
    const maxRZ = Math.floor((maxZ + 10) / ruinCellSize);
    for (let cz = minRZ; cz <= maxRZ; cz += 1) {
      for (let cx = minRX; cx <= maxRX; cx += 1) {
        if (deterministicUnit2D(cx, cz, this.numericSeed, 0x51ed270b) > 0.18) continue;
        const x = cx * ruinCellSize + 10 + Math.floor(deterministicUnit2D(cx, cz, this.numericSeed, 0x19a7c1) * 28);
        const z = cz * ruinCellSize + 10 + Math.floor(deterministicUnit2D(cx, cz, this.numericSeed, 0x31e2b9) * 28);
        if (this.sampleTerrain(x, z).height > SEA_LEVEL + 1) anchors.push({ x, z, kind: 'ruin' });
      }
    }
    return anchors;
  }

  private stampFeature(chunk: Chunk, anchor: FeatureAnchor): void {
    const groundY = this.sampleTerrain(anchor.x, anchor.z).height;
    if (anchor.kind === 'tree') {
      const height = 4 + Math.floor(deterministicUnit2D(anchor.x, anchor.z, this.numericSeed, 0x6a09e667) * 3);
      for (let y = 1; y <= height; y += 1) this.setIfInside(chunk, anchor.x, groundY + y, anchor.z, BlockIds.WOOD, true);
      for (let dy = height - 2; dy <= height + 1; dy += 1) {
        const radius = dy >= height + 1 ? 1 : 2;
        for (let dz = -radius; dz <= radius; dz += 1) for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
          this.setIfInside(chunk, anchor.x + dx, groundY + dy, anchor.z + dz, BlockIds.LEAVES, false);
        }
      }
      return;
    }
    if (anchor.kind === 'shrub') {
      this.setIfInside(chunk, anchor.x, groundY + 1, anchor.z, BlockIds.SHRUB, false);
      return;
    }
    const baseY = groundY + 1;
    for (let dz = -3; dz <= 3; dz += 1) for (let dx = -3; dx <= 3; dx += 1) {
      const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
      if (!edge) continue;
      const maxY = 1 + Math.floor(deterministicUnit3D(anchor.x + dx, 0, anchor.z + dz, this.numericSeed, 0xa54ff53a) * 3);
      for (let dy = 0; dy <= maxY; dy += 1) {
        if (deterministicUnit3D(anchor.x + dx, dy, anchor.z + dz, this.numericSeed, 0x510e527f) < 0.18) continue;
        this.setIfInside(chunk, anchor.x + dx, baseY + dy, anchor.z + dz, BlockIds.STONE, true);
      }
    }
  }

  private setIfInside(chunk: Chunk, worldX: number, worldY: number, worldZ: number, blockId: number, overwrite: boolean): void {
    if (worldY < CHUNK_MIN_Y || worldY > CHUNK_MAX_Y) return;
    const localX = worldX - chunk.x * CHUNK_SIZE;
    const localZ = worldZ - chunk.z * CHUNK_SIZE;
    if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) return;
    const localY = worldYToLocal(worldY);
    const existing = chunk.get(localX, localY, localZ);
    if (!overwrite && existing !== BlockIds.AIR && existing !== BlockIds.WATER && existing !== BlockIds.SHRUB) return;
    chunk.set(localX, localY, localZ, blockId);
  }
}
