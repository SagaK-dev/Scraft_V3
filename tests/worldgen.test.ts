import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockIds } from '../src/blocks/BlockRegistry.ts';
import { Chunk } from '../src/world/Chunk.ts';
import { ChunkManager } from '../src/world/ChunkManager.ts';
import { ChunkStreamer, planChunkTargets } from '../src/world/ChunkStreamer.ts';
import { seedToUint32, valueNoise2D } from '../src/world/SeededNoise.ts';
import { WorldEditStore } from '../src/world/WorldEdits.ts';
import { WorldGenerator } from '../src/world/WorldGenerator.ts';
import { DEFAULT_WORLD_SEED, resolveWorldSeed, sanitizeWorldSeed } from '../src/world/WorldSeed.ts';
import { worldYToLocal } from '../src/world/coordinates.ts';

test('string seeds hash deterministically', () => {
  assert.equal(seedToUint32('same-seed'), seedToUint32('same-seed'));
  assert.notEqual(seedToUint32('same-seed'), seedToUint32('other-seed'));
});

test('seeded value noise is deterministic and bounded', () => {
  const seed = seedToUint32('noise');
  const a = valueNoise2D(-12.375, 91.125, seed);
  const b = valueNoise2D(-12.375, 91.125, seed);
  assert.equal(a, b);
  assert.ok(a >= -1 && a <= 1);
});

test('world seed parsing supports query-string seeds and safe fallback', () => {
  assert.equal(resolveWorldSeed('?seed=hello%20world'), 'hello world');
  assert.equal(resolveWorldSeed('?other=x'), DEFAULT_WORLD_SEED);
  assert.equal(sanitizeWorldSeed('   '), DEFAULT_WORLD_SEED);
  assert.equal(sanitizeWorldSeed(`x${'y'.repeat(200)}`).length, 96);
});

test('same seed produces identical terrain independent of generator instance', () => {
  const a = new WorldGenerator('deterministic');
  const b = new WorldGenerator('deterministic');
  for (const [x, z] of [[0, 0], [135, -92], [-2048, 771], [8192, -4096]] as const) {
    assert.deepEqual(a.sampleTerrain(x, z), b.sampleTerrain(x, z));
  }
});

test('different seeds produce different remote terrain', () => {
  const a = new WorldGenerator('seed-a');
  const b = new WorldGenerator('seed-b');
  const samplesA = [a.sampleTerrain(500, 800).height, a.sampleTerrain(-1200, 900).height, a.sampleTerrain(2400, -1900).height];
  const samplesB = [b.sampleTerrain(500, 800).height, b.sampleTerrain(-1200, 900).height, b.sampleTerrain(2400, -1900).height];
  assert.notDeepEqual(samplesA, samplesB);
});

test('spawn area is deliberately flattened for Phase 3 compatibility', () => {
  const generator = new WorldGenerator('spawn-test');
  assert.equal(generator.sampleTerrain(0, 0).height, -1);
  assert.equal(generator.sampleTerrain(12, -8).height, -1);
});

test('chunk generation is deterministic and places a valid surface', () => {
  const generator = new WorldGenerator('chunk-test');
  const first = generator.generateChunk(-2, 3);
  const second = generator.generateChunk(-2, 3);
  assert.deepEqual(first.voxels, second.voxels);

  const worldX = -2 * 16 + 7;
  const worldZ = 3 * 16 + 11;
  const sample = generator.sampleTerrain(worldX, worldZ);
  assert.equal(first.get(7, worldYToLocal(sample.height), 11), sample.surfaceBlockId);
  assert.equal(first.get(7, worldYToLocal(sample.height - 4), 11), BlockIds.STONE);
});

test('chunk target planning covers the requested square and prioritizes the center', () => {
  const targets = planChunkTargets(-3, 5, 2);
  assert.equal(targets.length, 25);
  assert.deepEqual(targets[0], { x: -3, z: 5, distanceSquared: 0 });
  assert.ok(targets.some(target => target.x === -5 && target.z === 3));
  assert.ok(targets.some(target => target.x === -1 && target.z === 7));
});

test('chunk streamer generates asynchronously nearest-first', async () => {
  const manager = new ChunkManager();
  const generated: string[] = [];
  const streamer = new ChunkStreamer(manager, (x, z) => {
    generated.push(`${x},${z}`);
    return new Chunk(x, z);
  }, { chunksPerSlice: 1, unloadPadding: 0 });

  streamer.update(0, 0, 1);
  assert.equal(manager.size, 0);
  assert.equal(streamer.pendingCount, 9);
  await waitFor(() => manager.size === 9);
  assert.equal(generated[0], '0,0');
  streamer.dispose();
});

test('chunk streamer handles negative player coordinates', async () => {
  const manager = new ChunkManager();
  const streamer = new ChunkStreamer(manager, (x, z) => new Chunk(x, z), { chunksPerSlice: 8, unloadPadding: 0 });
  streamer.update(-0.01, -0.01, 1);
  await waitFor(() => manager.size === 9);
  assert.equal(manager.hasChunk(-1, -1), true);
  assert.equal(manager.hasChunk(0, 0), true);
  streamer.dispose();
});

test('moving the stream center unloads far chunks and loads the new neighborhood', async () => {
  const manager = new ChunkManager();
  const streamer = new ChunkStreamer(manager, (x, z) => new Chunk(x, z), { chunksPerSlice: 8, unloadPadding: 0 });
  streamer.update(0, 0, 1);
  await waitFor(() => manager.size === 9);
  streamer.update(160, 0, 1);
  assert.equal(manager.hasChunk(0, 0), false);
  await waitFor(() => manager.size === 9 && manager.hasChunk(10, 0));
  assert.equal(manager.hasChunk(9, -1), true);
  assert.equal(manager.hasChunk(11, 1), true);
  streamer.dispose();
});

test('runtime edits can be reapplied after a chunk unload/regeneration', () => {
  const generator = new WorldGenerator('edit-test');
  const edits = new WorldEditStore();
  const sample = generator.sampleTerrain(1, 1);
  edits.record(1, sample.height, 1, BlockIds.AIR);
  edits.record(2, sample.height + 3, 1, BlockIds.DIRT);

  const regenerated = generator.generateChunk(0, 0);
  assert.equal(edits.applyToChunk(regenerated), 2);
  assert.equal(regenerated.get(1, worldYToLocal(sample.height), 1), BlockIds.AIR);
  assert.equal(regenerated.get(2, worldYToLocal(sample.height + 3), 1), BlockIds.DIRT);
  assert.equal(edits.size, 2);
});

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for asynchronous chunk generation.');
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  }
}

test('chunk streamer retries transient generation failures without looping forever', async () => {
  const manager = new ChunkManager();
  let attempts = 0;
  const streamer = new ChunkStreamer(manager, (x, z) => {
    attempts += 1;
    if (attempts === 1) throw new Error('transient');
    return new Chunk(x, z);
  }, { chunksPerSlice: 1, unloadPadding: 0 });
  streamer.update(0, 0, 1);
  await waitFor(() => manager.hasChunk(0, 0));
  assert.ok(attempts >= 2);
  streamer.dispose();
});
