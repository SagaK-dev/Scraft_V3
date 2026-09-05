import * as THREE from 'three';
import { BlockIds, createDefaultBlockRegistry, type BlockRegistry } from '../blocks/BlockRegistry';
import type { AABB } from '../player/aabb';
import { intersectsUnitBlock } from '../player/aabb';
import { ChunkStreamer } from './ChunkStreamer';
import { ChunkManager, chunkKey } from './ChunkManager';
import { buildChunkMeshData } from './ChunkMesher';
import { CHUNK_SIZE } from './coordinates';
import { raycastVoxels, type Vec3Like, type VoxelHit } from './VoxelRaycast';
import { WorldEditStore } from './WorldEdits';
import { WorldGenerator } from './WorldGenerator';
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
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly outline: THREE.LineSegments;
  private readonly edits = new WorldEditStore();
  private readonly generator: WorldGenerator;
  private readonly streamer: ChunkStreamer;

  constructor(
    private readonly scene: THREE.Scene,
    options: VoxelWorldOptions = {},
    blocks = createDefaultBlockRegistry(),
  ) {
    this.blocks = blocks;
    this.seed = sanitizeWorldSeed(options.seed ?? DEFAULT_WORLD_SEED);
    this.generator = new WorldGenerator(this.seed);
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
        onChunksChanged: () => this.rebuildDirtyMeshes(),
        onError: error => {
          const message = error instanceof Error ? error.message : 'Unknown terrain generation error.';
          options.onGenerationError?.(`チャンク生成に失敗しました: ${message}`);
        },
      },
    );
  }

  updateStreaming(worldX: number, worldZ: number, renderDistance: number): void {
    this.streamer.update(worldX, worldZ, renderDistance);
  }

  raycast(origin: Vec3Like, direction: Vec3Like, maxDistance = INTERACTION_DISTANCE): VoxelHit | null {
    return raycastVoxels(origin, direction, maxDistance, (x, y, z) => this.chunks.getBlock(x, y, z), id => !this.blocks.isAir(id));
  }

  breakBlock(hit: VoxelHit): boolean {
    if (this.blocks.isAir(hit.blockId)) return false;
    const result = this.chunks.setBlock(hit.x, hit.y, hit.z, BlockIds.AIR);
    if (result.changed) {
      this.edits.record(hit.x, hit.y, hit.z, BlockIds.AIR);
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
    if (this.chunks.getBlock(x, y, z) !== BlockIds.AIR) return false;
    if (intersectsUnitBlock(playerBounds, x, y, z)) return false;
    const result = this.chunks.setBlock(x, y, z, blockId);
    if (result.changed) {
      this.edits.record(x, y, z, blockId);
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
      const data = buildChunkMeshData(chunk, this.chunks, this.blocks);
      if (data.indices.length === 0) continue;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const mesh = new THREE.Mesh(geometry, this.material);
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
    this.scene.remove(this.root);
    this.scene.remove(this.outline);
    for (const mesh of this.meshes.values()) mesh.geometry.dispose();
    this.meshes.clear();
    this.material.dispose();
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  get pendingChunkCount(): number {
    return this.streamer.pendingCount;
  }

  get runtimeEditCount(): number {
    return this.edits.size;
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
