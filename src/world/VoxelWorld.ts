import * as THREE from 'three';
import { BlockIds, createDefaultBlockRegistry, type BlockRegistry } from '../blocks/BlockRegistry';
import type { AABB } from '../player/aabb';
import { intersectsUnitBlock } from '../player/aabb';
import { ChunkStreamer } from './ChunkStreamer';
import { ChunkManager, chunkKey } from './ChunkManager';
import { buildChunkMeshData } from './ChunkMesher';
import { CHUNK_MAX_Y, CHUNK_MIN_Y, CHUNK_SIZE, splitCoordinate } from './coordinates';
import { LightEngine } from './LightEngine';
import { raycastVoxels, type Vec3Like, type VoxelHit } from './VoxelRaycast';
import { WorldEditStore } from './WorldEdits';
import { SEA_LEVEL, WorldGenerator } from './WorldGenerator';
import { DEFAULT_WORLD_SEED, sanitizeWorldSeed } from './WorldSeed';

const INTERACTION_DISTANCE = 6;

export interface VoxelWorldOptions {
  readonly seed?: string;
  readonly onGenerationError?: (message: string) => void;
}

export class VoxelWorld {
  readonly blocks: BlockRegistry;
  readonly chunks = new ChunkManager();
  readonly seed: string;
  private readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly opaqueMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly transparentMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  private readonly outline: THREE.LineSegments;
  private readonly edits = new WorldEditStore();
  private readonly generator: WorldGenerator;
  private readonly streamer: ChunkStreamer;
  private readonly lightEngine: LightEngine;
  private physicsCenterKey = '';

  constructor(
    private readonly scene: THREE.Scene,
    options: VoxelWorldOptions = {},
    blocks = createDefaultBlockRegistry(),
  ) {
    this.blocks = blocks;
    this.seed = sanitizeWorldSeed(options.seed ?? DEFAULT_WORLD_SEED);
    this.generator = new WorldGenerator(this.seed);
    this.lightEngine = new LightEngine(this.chunks, blocks);
    this.root.name = 'voxel-world';
    scene.add(this.root);
    this.outline = this.createOutline();
    scene.add(this.outline);
    this.streamer = new ChunkStreamer(
      this.chunks,
      (chunkX, chunkZ) => {
        const chunk = this.generator.generateChunk(chunkX, chunkZ);
        this.edits.applyToChunk(chunk);
        return chunk;
      },
      {
        chunksPerSlice: 1,
        unloadPadding: 2,
        onChunksChanged: () => {
          this.lightEngine.clearCaches();
          this.rebuildDirtyMeshes();
        },
        onError: error => {
          const message = error instanceof Error ? error.message : 'Unknown terrain generation error.';
          options.onGenerationError?.(`チャンク生成に失敗しました: ${message}`);
        },
      },
    );
  }

  updateStreaming(worldX: number, worldZ: number, renderDistance: number): void {
    this.ensurePhysicsNeighborhood(worldX, worldZ);
    this.streamer.update(worldX, worldZ, renderDistance);
  }

  ensurePhysicsNeighborhood(worldX: number, worldZ: number, radius = 1): void {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) throw new RangeError('Physics neighborhood coordinates must be finite.');
    if (!Number.isInteger(radius) || radius < 0 || radius > 2) throw new RangeError('Physics neighborhood radius must be an integer from 0 to 2.');
    const centerX = splitCoordinate(worldX).chunk;
    const centerZ = splitCoordinate(worldZ).chunk;
    const centerKey = `${centerX},${centerZ},${radius}`;
    if (centerKey === this.physicsCenterKey) return;
    this.physicsCenterKey = centerKey;
    let changed = false;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const chunkX = centerX + dx;
        const chunkZ = centerZ + dz;
        if (this.chunks.hasChunk(chunkX, chunkZ)) continue;
        const chunk = this.generator.generateChunk(chunkX, chunkZ);
        this.edits.applyToChunk(chunk);
        this.chunks.add(chunk);
        changed = true;
      }
    }
    if (changed) {
      this.lightEngine.clearCaches();
      this.rebuildDirtyMeshes();
    }
  }

  getSurfaceHeight(worldX: number, worldZ: number): number { return this.generator.sampleTerrain(worldX, worldZ).height; }
  getSafeSpawnFeetY(worldX: number, worldZ: number): number { return Math.max(this.generator.sampleTerrain(worldX, worldZ).height, SEA_LEVEL) + 1; }
  getBiome(worldX: number, worldZ: number): string { return this.generator.sampleTerrain(worldX, worldZ).biome; }

  getBlockId(x: number, y: number, z: number): number {
    if (![x, y, z].every(Number.isInteger)) throw new TypeError('Block coordinates must be integers.');
    return this.chunks.getBlock(x, y, z);
  }

  isSolidBlock(x: number, y: number, z: number): boolean {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) throw new TypeError('Collision block coordinates must be integers.');
    if (y < CHUNK_MIN_Y) return true;
    if (y > CHUNK_MAX_Y) return false;
    const chunkX = splitCoordinate(x).chunk;
    const chunkZ = splitCoordinate(z).chunk;
    if (!this.chunks.hasChunk(chunkX, chunkZ)) return true;
    return this.blocks.get(this.chunks.getBlock(x, y, z)).solid;
  }

  isLiquidBlock = (x: number, y: number, z: number): boolean => {
    if (![x, y, z].every(Number.isInteger)) return false;
    if (y < CHUNK_MIN_Y || y > CHUNK_MAX_Y) return false;
    const chunkX = splitCoordinate(x).chunk;
    const chunkZ = splitCoordinate(z).chunk;
    if (!this.chunks.hasChunk(chunkX, chunkZ)) return false;
    return this.blocks.get(this.chunks.getBlock(x, y, z)).liquid === true;
  };

  raycast(origin: Vec3Like, direction: Vec3Like, maxDistance = INTERACTION_DISTANCE): VoxelHit | null {
    return raycastVoxels(
      origin,
      direction,
      maxDistance,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      id => !this.blocks.isAir(id) && !this.blocks.get(id).liquid,
    );
  }

  breakBlock(hit: VoxelHit): boolean {
    if (this.blocks.isAir(hit.blockId) || this.blocks.get(hit.blockId).liquid) return false;
    const result = this.chunks.setBlock(hit.x, hit.y, hit.z, BlockIds.AIR);
    if (result.changed) {
      this.edits.record(hit.x, hit.y, hit.z, BlockIds.AIR);
      this.invalidateLightingAround(hit.x, hit.z);
      this.rebuildDirtyMeshes();
    }
    return result.changed;
  }

  placeBlock(hit: VoxelHit, blockId: number, playerBounds: AABB): boolean {
    const block = this.blocks.get(blockId);
    if (!block.placeable) return false;
    const x = hit.x + hit.normal[0];
    const y = hit.y + hit.normal[1];
    const z = hit.z + hit.normal[2];
    const existingId = this.chunks.getBlock(x, y, z);
    if (!this.blocks.isAir(existingId) && !this.blocks.get(existingId).replaceable) return false;
    if (block.solid && intersectsUnitBlock(playerBounds, x, y, z)) return false;
    const result = this.chunks.setBlock(x, y, z, blockId);
    if (result.changed) {
      this.edits.record(x, y, z, blockId);
      this.invalidateLightingAround(x, z);
      this.rebuildDirtyMeshes();
    }
    return result.changed;
  }

  setSelection(hit: VoxelHit | null, breakProgress = 0): void {
    this.outline.visible = hit !== null;
    if (!hit) return;
    this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    const scale = 1.002 + Math.min(1, Math.max(0, breakProgress)) * 0.025;
    this.outline.scale.setScalar(scale);
    const material = this.outline.material as THREE.LineBasicMaterial;
    material.opacity = 0.82 + Math.min(1, Math.max(0, breakProgress)) * 0.18;
  }

  rebuildDirtyMeshes(): void {
    for (const key of this.chunks.takeDirtyChunkKeys()) {
      const existing = this.meshes.get(key);
      if (existing) {
        this.root.remove(existing);
        existing.geometry.dispose();
        this.meshes.delete(key);
      }
      const [xText, zText] = key.split(',');
      const chunkX = Number(xText);
      const chunkZ = Number(zText);
      const chunk = this.chunks.getChunk(chunkX, chunkZ);
      if (!chunk) continue;
      const lighting = this.lightEngine.buildChunkLighting(chunkX, chunkZ);
      const data = buildChunkMeshData(chunk, this.chunks, this.blocks, lighting.sample);
      if (data.indices.length === 0) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
      geometry.clearGroups();
      if (data.opaqueIndexCount > 0) geometry.addGroup(0, data.opaqueIndexCount, 0);
      if (data.transparentIndexCount > 0) geometry.addGroup(data.opaqueIndexCount, data.transparentIndexCount, 1);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, [this.opaqueMaterial, this.transparentMaterial]);
      mesh.name = `chunk-${key}`;
      mesh.position.set(chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.frustumCulled = true;
      this.meshes.set(key, mesh);
      this.root.add(mesh);
    }
  }

  dispose(): void {
    this.streamer.dispose();
    this.lightEngine.clearCaches();
    this.scene.remove(this.root);
    this.scene.remove(this.outline);
    for (const mesh of this.meshes.values()) mesh.geometry.dispose();
    this.meshes.clear();
    this.opaqueMaterial.dispose();
    this.transparentMaterial.dispose();
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
  }

  get loadedChunkCount(): number { return this.chunks.size; }
  get pendingChunkCount(): number { return this.streamer.pendingCount; }
  get runtimeEditCount(): number { return this.edits.size; }

  private invalidateLightingAround(worldX: number, worldZ: number): void {
    const chunkX = splitCoordinate(worldX).chunk;
    const chunkZ = splitCoordinate(worldZ).chunk;
    for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) this.lightEngine.invalidateChunkSources(chunkX + dx, chunkZ + dz);
    this.chunks.markRadiusDirty(chunkX, chunkZ, 1);
  }

  private createOutline(): THREE.LineSegments {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: true });
    const outline = new THREE.LineSegments(edges, material);
    outline.name = 'block-selection-outline';
    outline.visible = false;
    outline.renderOrder = 2;
    return outline;
  }
}

export { chunkKey };
