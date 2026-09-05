export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256;
export const CHUNK_MIN_Y = -64;
export const CHUNK_MAX_Y = CHUNK_MIN_Y + CHUNK_HEIGHT - 1;

export interface SplitCoordinate {
  readonly block: number;
  readonly chunk: number;
  readonly local: number;
}

export function floorDiv(value: number, divisor: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0) {
    throw new RangeError('floorDiv expects a finite value and a positive finite divisor.');
  }
  return Math.floor(value / divisor);
}

export function positiveMod(value: number, modulus: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(modulus) || modulus <= 0) {
    throw new RangeError('positiveMod expects a finite value and a positive finite modulus.');
  }
  return ((value % modulus) + modulus) % modulus;
}

export function splitCoordinate(value: number, chunkSize = CHUNK_SIZE): SplitCoordinate {
  const block = Math.floor(value);
  return {
    block,
    chunk: floorDiv(block, chunkSize),
    local: positiveMod(block, chunkSize),
  };
}

export function worldYToLocal(worldY: number): number {
  if (!Number.isInteger(worldY) || worldY < CHUNK_MIN_Y || worldY > CHUNK_MAX_Y) {
    throw new RangeError(`World Y must be an integer from ${CHUNK_MIN_Y} to ${CHUNK_MAX_Y}.`);
  }
  return worldY - CHUNK_MIN_Y;
}

export function localYToWorld(localY: number): number {
  if (!Number.isInteger(localY) || localY < 0 || localY >= CHUNK_HEIGHT) {
    throw new RangeError(`Local Y must be an integer from 0 to ${CHUNK_HEIGHT - 1}.`);
  }
  return localY + CHUNK_MIN_Y;
}
