export interface AABB {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export function intersectsUnitBlock(bounds: AABB, x: number, y: number, z: number): boolean {
  const epsilon = 1e-7;
  return bounds.maxX > x + epsilon
    && bounds.minX < x + 1 - epsilon
    && bounds.maxY > y + epsilon
    && bounds.minY < y + 1 - epsilon
    && bounds.maxZ > z + epsilon
    && bounds.minZ < z + 1 - epsilon;
}
