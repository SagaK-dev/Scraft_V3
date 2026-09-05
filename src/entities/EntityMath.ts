import type { AABB } from '../player/aabb.ts';
import type { Vec3Like } from './EntityTypes.ts';

export function distanceSquared(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function horizontalDistanceSquared(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function segmentAABBIntersectionT(start: Vec3Like, end: Vec3Like, box: AABB): number | null {
  let tMin = 0;
  let tMax = 1;
  const axes = [
    [start.x, end.x - start.x, box.minX, box.maxX],
    [start.y, end.y - start.y, box.minY, box.maxY],
    [start.z, end.z - start.z, box.minZ, box.maxZ],
  ] as const;
  for (const [origin, delta, min, max] of axes) {
    if (Math.abs(delta) < 1e-12) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const inv = 1 / delta;
    let t1 = (min - origin) * inv;
    let t2 = (max - origin) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

export function segmentIntersectsAABB(start: Vec3Like, end: Vec3Like, box: AABB): boolean {
  return segmentAABBIntersectionT(start, end, box) !== null;
}

export function pointAABBDistanceSquared(point: Vec3Like, box: AABB): number {
  const dx = Math.max(box.minX - point.x, 0, point.x - box.maxX);
  const dy = Math.max(box.minY - point.y, 0, point.y - box.maxY);
  const dz = Math.max(box.minZ - point.z, 0, point.z - box.maxZ);
  return dx * dx + dy * dy + dz * dz;
}

export function knockbackVector(from: Vec3Like, to: Vec3Like, horizontalStrength: number, verticalStrength = 0.22): { x: number; y: number; z: number } {
  if (!Number.isFinite(horizontalStrength) || horizontalStrength < 0 || !Number.isFinite(verticalStrength)) throw new RangeError('Invalid knockback strength.');
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-9) return { x: 0, y: verticalStrength, z: horizontalStrength };
  return { x: dx / length * horizontalStrength, y: verticalStrength, z: dz / length * horizontalStrength };
}
