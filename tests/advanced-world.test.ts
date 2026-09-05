import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockIds, createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.ts';
import { Chunk } from '../src/world/Chunk.ts';
import { ChunkManager } from '../src/world/ChunkManager.ts';
import { buildChunkMeshData } from '../src/world/ChunkMesher.ts';
import { LightEngine } from '../src/world/LightEngine.ts';
import { fbm3D, seedToUint32, valueNoise3D } from '../src/world/SeededNoise.ts';
import { WeatherSystem } from '../src/world/WeatherSystem.ts';
import { SEA_LEVEL, WorldGenerator } from '../src/world/WorldGenerator.ts';
import { CHUNK_MIN_Y, worldYToLocal } from '../src/world/coordinates.ts';

test('3D seeded noise is deterministic and bounded', () => {
  const seed = seedToUint32('phase8-noise');
  const a = valueNoise3D(-1.25, 7.5, 9.125, seed);
  const b = valueNoise3D(-1.25, 7.5, 9.125, seed);
  assert.equal(a, b);
  assert.ok(a >= -1 && a <= 1);
  const f = fbm3D(1.2, -3.4, 5.6, seed, 4);
  assert.ok(f >= -1 && f <= 1);
});

test('biomes are deterministic and produce multiple climate regions', () => {
  const a = new WorldGenerator('phase8-biomes');
  const b = new WorldGenerator('phase8-biomes');
  const kinds = new Set<string>();
  for (let z = -6000; z <= 6000; z += 1000) {
    for (let x = -6000; x <= 6000; x += 1000) {
      const one = a.sampleTerrain(x, z);
      const two = b.sampleTerrain(x, z);
      assert.deepEqual(one, two);
      kinds.add(one.biome);
    }
  }
  assert.ok(kinds.size >= 3);
});

test('advanced chunk generation contains water caves and all ore classes across a deterministic region', () => {
  const generator = new WorldGenerator('phase8-resources');
  const found = new Set<number>();
  let caveFound = false;
  for (let cz = -3; cz <= 3; cz += 1) {
    for (let cx = -3; cx <= 3; cx += 1) {
      const chunk = generator.generateChunk(cx, cz);
      for (let lz = 0; lz < 16; lz += 1) {
        for (let lx = 0; lx < 16; lx += 1) {
          const wx = cx * 16 + lx;
          const wz = cz * 16 + lz;
          const surface = generator.sampleTerrain(wx, wz).height;
          for (let y = CHUNK_MIN_Y + 4; y <= Math.min(surface - 5, 28); y += 1) {
            const id = chunk.get(lx, worldYToLocal(y), lz);
            if (id === BlockIds.AIR) caveFound = true;
            if (id === BlockIds.COAL_ORE || id === BlockIds.IRON_ORE || id === BlockIds.GLOW_CRYSTAL) found.add(id);
          }
          if (surface < SEA_LEVEL && chunk.get(lx, worldYToLocal(SEA_LEVEL), lz) === BlockIds.WATER) found.add(BlockIds.WATER);
        }
      }
    }
  }
  assert.equal(caveFound, true);
  assert.equal(found.has(BlockIds.WATER), true);
  assert.equal(found.has(BlockIds.COAL_ORE), true);
  assert.equal(found.has(BlockIds.IRON_ORE), true);
  assert.equal(found.has(BlockIds.GLOW_CRYSTAL), true);
});

test('cross-chunk trees and structures remain deterministic regardless of generation order', () => {
  const first = new WorldGenerator('phase8-features');
  const a0 = first.generateChunk(-1, 2);
  const a1 = first.generateChunk(0, 2);
  const second = new WorldGenerator('phase8-features');
  const b1 = second.generateChunk(0, 2);
  const b0 = second.generateChunk(-1, 2);
  assert.deepEqual(a0.voxels, b0.voxels);
  assert.deepEqual(a1.voxels, b1.voxels);
});

test('block light propagates from glow crystal while skylight remains available above terrain', () => {
  const blocks = createDefaultBlockRegistry();
  const chunks = new ChunkManager();
  const chunk = new Chunk(0, 0);
  chunk.set(8, worldYToLocal(0), 8, BlockIds.GLOW_CRYSTAL);
  chunks.add(chunk);
  chunks.takeDirtyChunkKeys();
  const engine = new LightEngine(chunks, blocks);
  const lighting = engine.buildChunkLighting(0, 0);
  const source = lighting.sampleLevels(8, 0, 8);
  const neighbor = lighting.sampleLevels(9, 0, 8);
  const sky = lighting.sampleLevels(8, 20, 8);
  assert.equal(source.block, 12);
  assert.ok(neighbor.block >= 10);
  assert.equal(sky.sky, 15);
});

test('water mesh is emitted only in the transparent index section', () => {
  const blocks = createDefaultBlockRegistry();
  const manager = new ChunkManager();
  const chunk = new Chunk(0, 0);
  chunk.set(1, worldYToLocal(0), 1, BlockIds.WATER);
  manager.add(chunk);
  const mesh = buildChunkMeshData(chunk, manager, blocks);
  assert.equal(mesh.faceCount, 6);
  assert.equal(mesh.opaqueIndexCount, 0);
  assert.equal(mesh.transparentIndexCount, 36);
});

test('weather sequence is deterministic for a seed and includes precipitation over time', () => {
  const a = new WeatherSystem('phase8-weather');
  const b = new WeatherSystem('phase8-weather');
  let sawPrecipitation = a.phase !== 'clear';
  for (let i = 0; i < 120; i += 1) {
    a.update(10);
    b.update(10);
    assert.deepEqual(a.snapshot, b.snapshot);
    if (a.phase === 'rain' || a.phase === 'storm') sawPrecipitation = true;
    assert.ok(a.intensity >= 0 && a.intensity <= 1);
  }
  assert.equal(sawPrecipitation, true);
});
