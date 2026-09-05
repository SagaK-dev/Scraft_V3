import type { BlockRegistry } from '../blocks/BlockRegistry.ts';
import type { Chunk } from './Chunk.ts';
import type { ChunkManager } from './ChunkManager.ts';
import { CHUNK_MIN_Y, CHUNK_SIZE, localYToWorld } from './coordinates.ts';

export interface ChunkMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly faceCount: number;
  readonly opaqueIndexCount: number;
  readonly transparentIndexCount: number;
}

export type LightSampler = (worldX: number, worldY: number, worldZ: number) => number;

interface Face {
  readonly normal: readonly [number, number, number];
  readonly vertices: readonly (readonly [number, number, number])[];
  readonly shade: number;
}

interface SectionBuilder {
  readonly positions: number[];
  readonly normals: number[];
  readonly colors: number[];
  readonly indices: number[];
  faceCount: number;
}

const FACES: readonly Face[] = [
  { normal: [1, 0, 0], vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.82 },
  { normal: [-1, 0, 0], vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.72 },
  { normal: [0, 1, 0], vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { normal: [0, -1, 0], vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { normal: [0, 0, 1], vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.9 },
  { normal: [0, 0, -1], vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.78 },
];

export function buildChunkMeshData(chunk: Chunk, chunks: ChunkManager, blocks: BlockRegistry, lightSampler: LightSampler = () => 1): ChunkMeshData {
  const opaque = createSection();
  const transparent = createSection();

  if (!chunk.empty) {
    for (let localY = chunk.minFilledY; localY <= chunk.maxFilledY; localY += 1) {
      const worldY = localYToWorld(localY);
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
        for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
          const blockId = chunk.get(localX, localY, localZ);
          if (blocks.isAir(blockId)) continue;
          const block = blocks.get(blockId);
          const worldX = chunk.x * CHUNK_SIZE + localX;
          const worldZ = chunk.z * CHUNK_SIZE + localZ;
          const section = block.translucent ? transparent : opaque;

          for (const face of FACES) {
            const nx = worldX + face.normal[0];
            const ny = worldY + face.normal[1];
            const nz = worldZ + face.normal[2];
            const neighborId = chunks.getBlock(nx, ny, nz);
            if (!blocks.isAir(neighborId) && (neighborId === blockId || blocks.get(neighborId).opaque)) continue;
            appendFace(section, localX, worldY, localZ, block.color, face, lightSampler(nx, ny, nz));
          }
        }
      }
    }
  }

  const opaqueVertices = opaque.positions.length / 3;
  const positions = [...opaque.positions, ...transparent.positions];
  const normals = [...opaque.normals, ...transparent.normals];
  const colors = [...opaque.colors, ...transparent.colors];
  const indices = [...opaque.indices, ...transparent.indices.map(index => index + opaqueVertices)];
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    faceCount: opaque.faceCount + transparent.faceCount,
    opaqueIndexCount: opaque.indices.length,
    transparentIndexCount: transparent.indices.length,
  };
}

function createSection(): SectionBuilder {
  return { positions: [], normals: [], colors: [], indices: [], faceCount: 0 };
}

function appendFace(section: SectionBuilder, localX: number, worldY: number, localZ: number, color: number, face: Face, light: number): void {
  const base = section.positions.length / 3;
  const rgb = shadedRgb(color, face.shade * clampLight(light));
  for (const vertex of face.vertices) {
    section.positions.push(localX + vertex[0], worldY + vertex[1], localZ + vertex[2]);
    section.normals.push(face.normal[0], face.normal[1], face.normal[2]);
    section.colors.push(rgb[0], rgb[1], rgb[2]);
  }
  section.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  section.faceCount += 1;
}

function clampLight(value: number): number {
  return Number.isFinite(value) ? Math.min(1.5, Math.max(0.08, value)) : 1;
}

function shadedRgb(color: number, shade: number): readonly [number, number, number] {
  const r = ((color >>> 16) & 0xff) / 255;
  const g = ((color >>> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  return [r * shade, g * shade, b * shade];
}

export const CHUNK_MESH_WORLD_MIN_Y = CHUNK_MIN_Y;
