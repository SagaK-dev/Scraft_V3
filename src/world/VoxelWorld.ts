import * as THREE from 'three';
import { BlockIds, createDefaultBlockRegistry, type BlockRegistry } from '../blocks/BlockRegistry';
import type { AABB } from '../player/aabb';
import { intersectsUnitBlock } from '../player/aabb';
import { Chunk } from './Chunk';
import { ChunkManager, chunkKey } from './ChunkManager';
import { buildChunkMeshData } from './ChunkMesher';
import { CHUNK_MIN_Y, CHUNK_SIZE, worldYToLocal } from './coordinates';
import { raycastVoxels, type Vec3Like, type VoxelHit } from './VoxelRaycast';

const INTERACTION_DISTANCE = 6;

export class VoxelWorld {
  readonly blocks: BlockRegistry;
  readonly chunks = new ChunkManager();
  private readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly outline: THREE.LineSegments;

  constructor(private readonly scene: THREE.Scene, blocks = createDefaultBlockRegistry()) {
    this.blocks = blocks;
    this.root.name = 'voxel-world';
    scene.add(this.root);
    this.outline = this.createOutline();
    scene.add(this.outline);
    this.generatePhaseTwoArea(2);
    this.rebuildDirtyMeshes();
  }

  raycast(origin: Vec3Like, direction: Vec3Like, maxDistance = INTERACTION_DISTANCE): VoxelHit | null {
    return raycastVoxels(origin, direction, maxDistance, (x, y, z) => this.chunks.getBlock(x, y, z), id => !this.blocks.isAir(id));
  }

  breakBlock(hit: VoxelHit): boolean {
    if (this.blocks.isAir(hit.blockId)) return false;
    const result = this.chunks.setBlock(hit.x, hit.y, hit.z, BlockIds.AIR);
    if (result.changed) this.rebuildDirtyMeshes();
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
    if (result.changed) this.rebuildDirtyMeshes();
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

  private generatePhaseTwoArea(radius: number): void {
    for (let chunkZ = -radius; chunkZ <= radius; chunkZ += 1) {
      for (let chunkX = -radius; chunkX <= radius; chunkX += 1) {
        const chunk = new Chunk(chunkX, chunkZ);
        for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
          for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
            chunk.set(localX, worldYToLocal(-4), localZ, BlockIds.STONE);
            chunk.set(localX, worldYToLocal(-3), localZ, BlockIds.STONE);
            chunk.set(localX, worldYToLocal(-2), localZ, BlockIds.DIRT);
            chunk.set(localX, worldYToLocal(-1), localZ, BlockIds.GRASS);
          }
        }
        this.chunks.add(chunk);
      }
    }

    // Small original-color test wall near spawn so Phase 2 interactions can be verified immediately.
    const samples = [BlockIds.STONE, BlockIds.DIRT, BlockIds.SAND, BlockIds.WOOD, BlockIds.LEAVES];
    for (let i = 0; i < samples.length; i += 1) {
      const id = samples[i];
      if (id === undefined) continue;
      this.chunks.setBlock(i - 2, 0, 11, id);
      this.chunks.setBlock(i - 2, 1, 11, id);
    }

    if (CHUNK_MIN_Y >= 0) throw new Error('Phase 2 terrain expects negative world Y support.');
    this.chunks.markAllDirty();
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
