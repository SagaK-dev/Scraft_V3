import { fbm2D } from './SeededNoise.ts';

export type BiomeKind = 'plains' | 'forest' | 'desert' | 'alpine';

export interface BiomeSample {
  readonly kind: BiomeKind;
  readonly temperature: number;
  readonly moisture: number;
  readonly treeDensity: number;
  readonly shrubDensity: number;
}

export function sampleBiome(worldX: number, worldZ: number, height: number, seed: number): BiomeSample {
  if (![worldX, worldZ, height].every(Number.isFinite)) throw new RangeError('Biome sample values must be finite.');
  const temperature = fbm2D(worldX * 0.0018 + 211.3, worldZ * 0.0018 - 91.7, seed ^ 0x4f1bbcdc, 4);
  const moisture = fbm2D(worldX * 0.0022 - 61.4, worldZ * 0.0022 + 173.2, seed ^ 0x92d68ca2, 4);

  if (height >= 34 || temperature < -0.52) return { kind: 'alpine', temperature, moisture, treeDensity: 0.015, shrubDensity: 0.025 };
  if (temperature > 0.08 && moisture < -0.08) return { kind: 'desert', temperature, moisture, treeDensity: 0, shrubDensity: 0.02 };
  if (moisture > 0.12) return { kind: 'forest', temperature, moisture, treeDensity: 0.23, shrubDensity: 0.12 };
  return { kind: 'plains', temperature, moisture, treeDensity: 0.07, shrubDensity: 0.08 };
}
