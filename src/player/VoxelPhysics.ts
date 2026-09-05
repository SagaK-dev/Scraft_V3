import type { AABB } from './aabb.ts';

const EPSILON = 1e-7;
const SUPPORT_PROBE = 0.08;

export interface VoxelCollisionSource {
  isSolidBlock(x: number, y: number, z: number): boolean;
}

export interface MotionVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MoveOptions {
  readonly stepHeight?: number;
  readonly allowStep?: boolean;
  readonly keepSupported?: boolean;
}

export interface CollisionMoveResult {
  readonly bounds: AABB;
  readonly moved: MotionVector;
  readonly hitX: boolean;
  readonly hitY: boolean;
  readonly hitZ: boolean;
  readonly hitCeiling: boolean;
  readonly grounded: boolean;
  readonly stepped: boolean;
}

interface AxisSweepResult {
  readonly bounds: AABB;
  readonly moved: number;
  readonly hit: boolean;
}

export function createAABB(centerX: number, feetY: number, centerZ: number, halfWidth: number, height: number): AABB {
  if (![centerX, feetY, centerZ, halfWidth, height].every(Number.isFinite)) throw new RangeError('AABB values must be finite.');
  if (halfWidth <= 0 || height <= 0) throw new RangeError('AABB dimensions must be positive.');
  return {
    minX: centerX - halfWidth,
    minY: feetY,
    minZ: centerZ - halfWidth,
    maxX: centerX + halfWidth,
    maxY: feetY + height,
    maxZ: centerZ + halfWidth,
  };
}

export function translateAABB(bounds: AABB, x: number, y: number, z: number): AABB {
  return {
    minX: bounds.minX + x,
    minY: bounds.minY + y,
    minZ: bounds.minZ + z,
    maxX: bounds.maxX + x,
    maxY: bounds.maxY + y,
    maxZ: bounds.maxZ + z,
  };
}

export function intersectsSolid(bounds: AABB, source: VoxelCollisionSource): boolean {
  for (const [x, y, z] of overlappingBlockCoordinates(bounds)) {
    if (source.isSolidBlock(x, y, z)) return true;
  }
  return false;
}

export function hasSupport(bounds: AABB, source: VoxelCollisionSource, probeDistance = SUPPORT_PROBE): boolean {
  if (!Number.isFinite(probeDistance) || probeDistance <= 0) throw new RangeError('Support probe distance must be positive.');
  const probe: AABB = {
    minX: bounds.minX + EPSILON,
    minY: bounds.minY - probeDistance,
    minZ: bounds.minZ + EPSILON,
    maxX: bounds.maxX - EPSILON,
    maxY: bounds.minY - EPSILON,
    maxZ: bounds.maxZ - EPSILON,
  };
  return intersectsSolid(probe, source);
}

export function moveAABB(
  initialBounds: AABB,
  delta: MotionVector,
  source: VoxelCollisionSource,
  options: MoveOptions = {},
): CollisionMoveResult {
  validateMotion(delta);
  const stepHeight = options.stepHeight ?? 0;
  if (!Number.isFinite(stepHeight) || stepHeight < 0 || stepHeight > 1.25) throw new RangeError('Step height must be from 0 to 1.25.');

  const vertical = sweepAxis(initialBounds, delta.y, 'y', source);
  const groundedAfterVertical = (delta.y < 0 && vertical.hit) || hasSupport(vertical.bounds, source);
  const direct = resolveHorizontal(vertical.bounds, delta.x, delta.z, source);
  let selected = direct;
  let finalBounds = direct.bounds;
  let stepped = false;
  let stepLandingHit = false;

  const canStep = options.allowStep === true
    && stepHeight > EPSILON
    && groundedAfterVertical
    && (direct.hitX || direct.hitZ)
    && (Math.abs(delta.x) > EPSILON || Math.abs(delta.z) > EPSILON);

  if (canStep) {
    const rise = sweepAxis(vertical.bounds, stepHeight, 'y', source);
    if (rise.moved > EPSILON && !rise.hit) {
      const raisedHorizontal = resolveHorizontal(rise.bounds, delta.x, delta.z, source);
      const settle = sweepAxis(raisedHorizontal.bounds, -(rise.moved + SUPPORT_PROBE), 'y', source);
      const directDistanceSq = direct.movedX * direct.movedX + direct.movedZ * direct.movedZ;
      const steppedDistanceSq = raisedHorizontal.movedX * raisedHorizontal.movedX + raisedHorizontal.movedZ * raisedHorizontal.movedZ;
      const validLanding = settle.hit && settle.bounds.minY >= vertical.bounds.minY - EPSILON;
      if (validLanding && steppedDistanceSq > directDistanceSq + EPSILON) {
        selected = raisedHorizontal;
        finalBounds = settle.bounds;
        stepped = true;
        stepLandingHit = true;
      }
    }
  }

  if (options.keepSupported === true && groundedAfterVertical && !hasSupport(finalBounds, source)) {
    const supported = resolveSupportedHorizontal(vertical.bounds, delta.x, delta.z, source);
    selected = supported;
    finalBounds = supported.bounds;
    stepped = false;
    stepLandingHit = false;
  }

  const movedX = finalBounds.minX - initialBounds.minX;
  const movedY = finalBounds.minY - initialBounds.minY;
  const movedZ = finalBounds.minZ - initialBounds.minZ;
  const grounded = stepLandingHit || (delta.y < 0 && vertical.hit) || hasSupport(finalBounds, source);

  return {
    bounds: finalBounds,
    moved: { x: movedX, y: movedY, z: movedZ },
    hitX: Math.abs(selected.movedX - delta.x) > EPSILON,
    hitY: vertical.hit,
    hitZ: Math.abs(selected.movedZ - delta.z) > EPSILON,
    hitCeiling: delta.y > 0 && vertical.hit,
    grounded,
    stepped,
  };
}

function resolveHorizontal(bounds: AABB, deltaX: number, deltaZ: number, source: VoxelCollisionSource): {
  readonly bounds: AABB;
  readonly movedX: number;
  readonly movedZ: number;
  readonly hitX: boolean;
  readonly hitZ: boolean;
} {
  const x = sweepAxis(bounds, deltaX, 'x', source);
  const z = sweepAxis(x.bounds, deltaZ, 'z', source);
  return { bounds: z.bounds, movedX: x.moved, movedZ: z.moved, hitX: x.hit, hitZ: z.hit };
}

function resolveSupportedHorizontal(bounds: AABB, deltaX: number, deltaZ: number, source: VoxelCollisionSource) {
  const full = resolveHorizontal(bounds, deltaX, deltaZ, source);
  if (hasSupport(full.bounds, source)) return full;

  let low = 0;
  let high = 1;
  let best = resolveHorizontal(bounds, 0, 0, source);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const middle = (low + high) / 2;
    const candidate = resolveHorizontal(bounds, deltaX * middle, deltaZ * middle, source);
    if (hasSupport(candidate.bounds, source)) {
      best = candidate;
      low = middle;
    } else {
      high = middle;
    }
  }
  return best;
}

function sweepAxis(bounds: AABB, delta: number, axis: 'x' | 'y' | 'z', source: VoxelCollisionSource): AxisSweepResult {
  if (Math.abs(delta) <= EPSILON) return { bounds, moved: 0, hit: false };

  const destination = translateAxis(bounds, axis, delta);
  const broadphase: AABB = {
    minX: Math.min(bounds.minX, destination.minX),
    minY: Math.min(bounds.minY, destination.minY),
    minZ: Math.min(bounds.minZ, destination.minZ),
    maxX: Math.max(bounds.maxX, destination.maxX),
    maxY: Math.max(bounds.maxY, destination.maxY),
    maxZ: Math.max(bounds.maxZ, destination.maxZ),
  };

  let allowed = delta;
  for (const [x, y, z] of overlappingBlockCoordinates(broadphase)) {
    if (!source.isSolidBlock(x, y, z)) continue;
    if (!overlapsOnOtherAxes(bounds, x, y, z, axis)) continue;

    const blockMin = axis === 'x' ? x : axis === 'y' ? y : z;
    const blockMax = blockMin + 1;
    const bodyMin = axis === 'x' ? bounds.minX : axis === 'y' ? bounds.minY : bounds.minZ;
    const bodyMax = axis === 'x' ? bounds.maxX : axis === 'y' ? bounds.maxY : bounds.maxZ;

    if (delta > 0) {
      if (blockMin < bodyMax - EPSILON) continue;
      const candidate = blockMin - bodyMax;
      if (candidate >= -EPSILON && candidate < allowed) allowed = Math.max(0, candidate);
    } else {
      if (blockMax > bodyMin + EPSILON) continue;
      const candidate = blockMax - bodyMin;
      if (candidate <= EPSILON && candidate > allowed) allowed = Math.min(0, candidate);
    }
  }

  return { bounds: translateAxis(bounds, axis, allowed), moved: allowed, hit: Math.abs(allowed - delta) > EPSILON };
}

function translateAxis(bounds: AABB, axis: 'x' | 'y' | 'z', amount: number): AABB {
  if (axis === 'x') return translateAABB(bounds, amount, 0, 0);
  if (axis === 'y') return translateAABB(bounds, 0, amount, 0);
  return translateAABB(bounds, 0, 0, amount);
}

function overlapsOnOtherAxes(bounds: AABB, x: number, y: number, z: number, axis: 'x' | 'y' | 'z'): boolean {
  if (axis !== 'x' && !rangesOverlap(bounds.minX, bounds.maxX, x, x + 1)) return false;
  if (axis !== 'y' && !rangesOverlap(bounds.minY, bounds.maxY, y, y + 1)) return false;
  if (axis !== 'z' && !rangesOverlap(bounds.minZ, bounds.maxZ, z, z + 1)) return false;
  return true;
}

function rangesOverlap(minA: number, maxA: number, minB: number, maxB: number): boolean {
  return maxA > minB + EPSILON && minA < maxB - EPSILON;
}

function overlappingBlockCoordinates(bounds: AABB): Array<readonly [number, number, number]> {
  const minX = Math.floor(bounds.minX + EPSILON);
  const minY = Math.floor(bounds.minY + EPSILON);
  const minZ = Math.floor(bounds.minZ + EPSILON);
  const maxX = Math.floor(bounds.maxX - EPSILON);
  const maxY = Math.floor(bounds.maxY - EPSILON);
  const maxZ = Math.floor(bounds.maxZ - EPSILON);
  const coordinates: Array<readonly [number, number, number]> = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) coordinates.push([x, y, z]);
    }
  }
  return coordinates;
}

function validateMotion(delta: MotionVector): void {
  if (![delta.x, delta.y, delta.z].every(Number.isFinite)) throw new RangeError('Motion delta must be finite.');
}
