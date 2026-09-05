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

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function latticeValue(x: number, z: number, seed: number): number {
  const a = Math.imul(x | 0, 0x1f123bb5);
  const b = Math.imul(z | 0, 0x5f356495);
  const hash = mix32((a ^ b ^ seed) >>> 0);
  return (hash / UINT32_MAX) * 2 - 1;
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
  const top = lerp(latticeValue(x0, z0, seed), latticeValue(x1, z0, seed), tx);
  const bottom = lerp(latticeValue(x0, z1, seed), latticeValue(x1, z1, seed), tx);
  return lerp(top, bottom, tz);
}

export function fbm2D(
  x: number,
  z: number,
  seed: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
): number {
  if (!Number.isInteger(octaves) || octaves < 1 || octaves > 12) throw new RangeError('Octaves must be an integer from 1 to 12.');
  if (!Number.isFinite(lacunarity) || lacunarity <= 1) throw new RangeError('Lacunarity must be greater than 1.');
  if (!Number.isFinite(gain) || gain <= 0 || gain >= 1) throw new RangeError('Gain must be between 0 and 1.');

  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = mix32(seed + Math.imul(octave + 1, 0x9e3779b1));
    sum += valueNoise2D(x * frequency, z * frequency, octaveSeed) * amplitude;
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
    const octaveSeed = mix32(seed ^ Math.imul(octave + 1, 0x85ebca6b));
    const sample = 1 - Math.abs(valueNoise2D(x * frequency, z * frequency, octaveSeed));
    sum += sample * sample * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return normalization > 0 ? sum / normalization : 0;
}
