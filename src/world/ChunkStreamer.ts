import { Chunk } from './Chunk.ts';
import { ChunkManager, chunkKey } from './ChunkManager.ts';
import { splitCoordinate } from './coordinates.ts';

export interface ChunkStreamTarget {
  readonly x: number;
  readonly z: number;
  readonly distanceSquared: number;
}

export interface ChunkStreamerOptions {
  readonly chunksPerSlice?: number;
  readonly unloadPadding?: number;
  readonly onChunksChanged?: () => void;
  readonly onError?: (error: unknown) => void;
}

export function planChunkTargets(centerX: number, centerZ: number, renderDistance: number): ChunkStreamTarget[] {
  if (!Number.isInteger(centerX) || !Number.isInteger(centerZ)) throw new TypeError('Chunk center coordinates must be integers.');
  if (!Number.isInteger(renderDistance) || renderDistance < 1 || renderDistance > 24) {
    throw new RangeError('Render distance must be an integer from 1 to 24.');
  }

  const targets: ChunkStreamTarget[] = [];
  for (let dz = -renderDistance; dz <= renderDistance; dz += 1) {
    for (let dx = -renderDistance; dx <= renderDistance; dx += 1) {
      targets.push({ x: centerX + dx, z: centerZ + dz, distanceSquared: dx * dx + dz * dz });
    }
  }
  targets.sort((a, b) => a.distanceSquared - b.distanceSquared || Math.abs(a.x - centerX) + Math.abs(a.z - centerZ) - (Math.abs(b.x - centerX) + Math.abs(b.z - centerZ)) || a.z - b.z || a.x - b.x);
  return targets;
}

export class ChunkStreamer {
  private readonly manager: ChunkManager;
  private readonly factory: (chunkX: number, chunkZ: number) => Chunk;
  private readonly chunksPerSlice: number;
  private readonly unloadPadding: number;
  private readonly onChunksChanged?: () => void;
  private readonly onError?: (error: unknown) => void;
  private desired = new Set<string>();
  private queued = new Set<string>();
  private queue: ChunkStreamTarget[] = [];
  private readonly failures = new Map<string, number>();
  private timer: number | undefined;
  private lastCenterX: number | undefined;
  private lastCenterZ: number | undefined;
  private lastDistance: number | undefined;
  private disposed = false;

  constructor(
    manager: ChunkManager,
    factory: (chunkX: number, chunkZ: number) => Chunk,
    options: ChunkStreamerOptions = {},
  ) {
    this.manager = manager;
    this.factory = factory;
    this.chunksPerSlice = clampInteger(options.chunksPerSlice ?? 1, 1, 8, 'chunksPerSlice');
    this.unloadPadding = clampInteger(options.unloadPadding ?? 2, 0, 8, 'unloadPadding');
    this.onChunksChanged = options.onChunksChanged;
    this.onError = options.onError;
  }

  update(worldX: number, worldZ: number, renderDistance: number): void {
    if (this.disposed) return;
    const centerX = splitCoordinate(worldX).chunk;
    const centerZ = splitCoordinate(worldZ).chunk;
    const distance = clampInteger(renderDistance, 1, 24, 'renderDistance');
    if (centerX === this.lastCenterX && centerZ === this.lastCenterZ && distance === this.lastDistance) return;
    this.lastCenterX = centerX;
    this.lastCenterZ = centerZ;
    this.lastDistance = distance;
    this.failures.clear();

    const targets = planChunkTargets(centerX, centerZ, distance);
    this.desired = new Set(targets.map(target => chunkKey(target.x, target.z)));

    let removedAny = false;
    const unloadDistance = distance + this.unloadPadding;
    for (const chunk of [...this.manager.values()]) {
      if (Math.abs(chunk.x - centerX) <= unloadDistance && Math.abs(chunk.z - centerZ) <= unloadDistance) continue;
      this.manager.remove(chunk.x, chunk.z);
      removedAny = true;
    }

    // Rebuild pending work whenever the center changes so nearest-first priority always reflects the current player chunk.
    this.queue = [];
    this.queued.clear();
    for (const target of targets) {
      const key = chunkKey(target.x, target.z);
      if (this.manager.hasChunk(target.x, target.z)) continue;
      this.queue.push(target);
      this.queued.add(key);
    }

    if (removedAny) this.onChunksChanged?.();
    this.schedulePump();
  }

  dispose(): void {
    this.disposed = true;
    this.desired.clear();
    this.queued.clear();
    this.failures.clear();
    this.queue.length = 0;
    if (this.timer !== undefined) {
      globalThis.clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  private schedulePump(): void {
    if (this.disposed || this.timer !== undefined || this.queue.length === 0) return;
    this.timer = globalThis.setTimeout(this.pump, 0);
  }

  private readonly pump = (): void => {
    this.timer = undefined;
    if (this.disposed) return;
    let changed = false;
    for (let generated = 0; generated < this.chunksPerSlice && this.queue.length > 0; generated += 1) {
      const target = this.queue.shift();
      if (!target) break;
      const key = chunkKey(target.x, target.z);
      this.queued.delete(key);
      if (!this.desired.has(key) || this.manager.hasChunk(target.x, target.z)) continue;
      try {
        const chunk = this.factory(target.x, target.z);
        if (!this.desired.has(key) || this.disposed) continue;
        this.manager.add(chunk);
        this.failures.delete(key);
        changed = true;
      } catch (error) {
        const failures = (this.failures.get(key) ?? 0) + 1;
        this.failures.set(key, failures);
        if (failures <= 2 && this.desired.has(key)) {
          this.queue.push(target);
          this.queued.add(key);
        } else {
          this.onError?.(error);
        }
      }
    }
    if (changed) this.onChunksChanged?.();
    this.schedulePump();
  };
}

function clampInteger(value: number, min: number, max: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return Math.min(max, Math.max(min, Math.round(value)));
}
