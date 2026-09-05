const UINT32_MAX = 0xffffffff;

export function seedToUint32(seed: string | number): number {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) throw new RangeError('Numeric seeds must be finite.');
    return Math.trunc(seed) >>> 0;
  }

  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function mixSeed32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

export function deterministicUnit2D(x: number, z: number, seed: number, salt = 0): number {
  if (!Number.isInteger(x) || !Number.isInteger(z)) throw new TypeError('Hash coordinates must be integers.');
  const a = Math.imul(x | 0, 0x1f123bb5);
  const b = Math.imul(z | 0, 0x5f356495);
  return mixSeed32((a ^ b ^ seed ^ salt) >>> 0) / UINT32_MAX;
}

export function deterministicUnit3D(x: number, y: number, z: number, seed: number, salt = 0): number {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) throw new TypeError('Hash coordinates must be integers.');
  const a = Math.imul(x | 0, 0x1f123bb5);
  const b = Math.imul(y | 0, 0x6c8e9cf5);
  const c = Math.imul(z | 0, 0x5f356495);
  return mixSeed32((a ^ b ^ c ^ seed ^ salt) >>> 0) / UINT32_MAX;
}

function latticeValue2D(x: number, z: number, seed: number): number {
  return deterministicUnit2D(x, z, seed) * 2 - 1;
}

function latticeValue3D(x: number, y: number, z: number, seed: number): number {
  return deterministicUnit3D(x, y, z, seed) * 2 - 1;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function valueNoise2D(x: number, z: number, seed: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('Noise coordinates must be finite.');
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const top = lerp(latticeValue2D(x0, z0, seed), latticeValue2D(x1, z0, seed), tx);
  const bottom = lerp(latticeValue2D(x0, z1, seed), latticeValue2D(x1, z1, seed), tx);
  return lerp(top, bottom, tz);
}

export function valueNoise3D(x: number, y: number, z: number, seed: number): number {
  if (![x, y, z].every(Number.isFinite)) throw new RangeError('Noise coordinates must be finite.');
  const x0 = Math.floor(x); const y0 = Math.floor(y); const z0 = Math.floor(z);
  const x1 = x0 + 1; const y1 = y0 + 1; const z1 = z0 + 1;
  const tx = fade(x - x0); const ty = fade(y - y0); const tz = fade(z - z0);
  const c000 = latticeValue3D(x0, y0, z0, seed);
  const c100 = latticeValue3D(x1, y0, z0, seed);
  const c010 = latticeValue3D(x0, y1, z0, seed);
  const c110 = latticeValue3D(x1, y1, z0, seed);
  const c001 = latticeValue3D(x0, y0, z1, seed);
  const c101 = latticeValue3D(x1, y0, z1, seed);
  const c011 = latticeValue3D(x0, y1, z1, seed);
  const c111 = latticeValue3D(x1, y1, z1, seed);
  const x00 = lerp(c000, c100, tx); const x10 = lerp(c010, c110, tx);
  const x01 = lerp(c001, c101, tx); const x11 = lerp(c011, c111, tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

export function fbm2D(
  x: number,
  z: number,
  seed: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
): number {
  validateFbm(octaves, lacunarity, gain);
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = mixSeed32(seed + Math.imul(octave + 1, 0x9e3779b1));
    sum += valueNoise2D(x * frequency, z * frequency, octaveSeed) * amplitude;
    normalization += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return normalization > 0 ? sum / normalization : 0;
}

export function fbm3D(
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  validateFbm(octaves, lacunarity, gain);
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = mixSeed32(seed ^ Math.imul(octave + 1, 0x85ebca6b));
    sum += valueNoise3D(x * frequency, y * frequency, z * frequency, octaveSeed) * amplitude;
    normalization += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return normalization > 0 ? sum / normalization : 0;
}

export function ridgedFbm2D(x: number, z: number, seed: number, octaves = 5): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = mixSeed32(seed ^ Math.imul(octave + 1, 0x85ebca6b));
    const sample = 1 - Math.abs(valueNoise2D(x * frequency, z * frequency, octaveSeed));
    sum += sample * sample * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return normalization > 0 ? sum / normalization : 0;
}

function validateFbm(octaves: number, lacunarity: number, gain: number): void {
  if (!Number.isInteger(octaves) || octaves < 1 || octaves > 12) throw new RangeError('Octaves must be an integer from 1 to 12.');
  if (!Number.isFinite(lacunarity) || lacunarity <= 1) throw new RangeError('Lacunarity must be greater than 1.');
  if (!Number.isFinite(gain) || gain <= 0 || gain >= 1) throw new RangeError('Gain must be between 0 and 1.');
}
