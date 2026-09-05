export const CHUNK_SIZE = 16;

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
