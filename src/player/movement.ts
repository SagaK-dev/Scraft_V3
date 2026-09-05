export function moveTowards(current: number, target: number, maxDelta: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(maxDelta) || maxDelta < 0) {
    throw new RangeError('moveTowards expects finite values and a non-negative maxDelta.');
  }
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
