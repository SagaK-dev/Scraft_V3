export const DEFAULT_WORLD_SEED = 'scraft-v3-default';

export function sanitizeWorldSeed(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_WORLD_SEED;
  return trimmed.slice(0, 96);
}

export function resolveWorldSeed(search?: string): string {
  const source = search ?? (typeof location === 'undefined' ? '' : location.search);
  try {
    return sanitizeWorldSeed(new URLSearchParams(source).get('seed'));
  } catch {
    return DEFAULT_WORLD_SEED;
  }
}
