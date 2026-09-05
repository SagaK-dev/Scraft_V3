export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface VoxelHit {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly blockId: number;
  readonly distance: number;
  readonly normal: readonly [number, number, number];
}

export function raycastVoxels(
  origin: Vec3Like,
  direction: Vec3Like,
  maxDistance: number,
  getBlock: (x: number, y: number, z: number) => number,
  isTarget: (blockId: number) => boolean = id => id !== 0,
): VoxelHit | null {
  if (!Number.isFinite(maxDistance) || maxDistance < 0) throw new RangeError('maxDistance must be finite and non-negative.');
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(length) || length <= 1e-12) return null;

  const dx = direction.x / length;
  const dy = direction.y / length;
  const dz = direction.z / length;
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const initial = getBlock(x, y, z);
  if (isTarget(initial)) return { x, y, z, blockId: initial, distance: 0, normal: [0, 0, 0] };

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);
  const deltaX = stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const deltaY = stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  const deltaZ = stepZ === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dz);
  let maxX = firstBoundaryDistance(origin.x, dx, stepX);
  let maxY = firstBoundaryDistance(origin.y, dy, stepY);
  let maxZ = firstBoundaryDistance(origin.z, dz, stepZ);

  while (true) {
    let distance: number;
    let normal: readonly [number, number, number];
    if (maxX <= maxY && maxX <= maxZ) {
      x += stepX;
      distance = maxX;
      maxX += deltaX;
      normal = [-stepX, 0, 0];
    } else if (maxY <= maxZ) {
      y += stepY;
      distance = maxY;
      maxY += deltaY;
      normal = [0, -stepY, 0];
    } else {
      z += stepZ;
      distance = maxZ;
      maxZ += deltaZ;
      normal = [0, 0, -stepZ];
    }

    if (distance > maxDistance) return null;
    const blockId = getBlock(x, y, z);
    if (isTarget(blockId)) return { x, y, z, blockId, distance, normal };
  }
}

function firstBoundaryDistance(origin: number, direction: number, step: number): number {
  if (step === 0) return Number.POSITIVE_INFINITY;
  if (step > 0) return (Math.floor(origin) + 1 - origin) / direction;
  return (origin - Math.floor(origin)) / -direction;
}
