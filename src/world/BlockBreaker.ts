import type { VoxelHit } from './VoxelRaycast.ts';

export interface BreakUpdate {
  readonly completed: boolean;
  readonly progress: number;
}

export class BlockBreaker {
  private target = '';
  private elapsed = 0;

  update(dt: number, active: boolean, hit: VoxelHit | null, hardness: number): BreakUpdate {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Break dt must be finite and non-negative.');
    if (!active || hit === null || !Number.isFinite(hardness) || hardness <= 0) {
      this.reset();
      return { completed: false, progress: 0 };
    }

    const key = `${hit.x},${hit.y},${hit.z},${hit.blockId}`;
    if (key !== this.target) {
      this.target = key;
      this.elapsed = 0;
    }

    this.elapsed += dt;
    const progress = Math.min(1, this.elapsed / hardness);
    if (progress >= 1) {
      this.reset();
      return { completed: true, progress: 1 };
    }
    return { completed: false, progress };
  }

  reset(): void {
    this.target = '';
    this.elapsed = 0;
  }
}
