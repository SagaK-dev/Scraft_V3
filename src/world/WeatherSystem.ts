import { deterministicUnit2D, seedToUint32 } from './SeededNoise.ts';

export type WeatherPhase = 'clear' | 'rain' | 'storm';

export interface WeatherSnapshot {
  readonly phase: WeatherPhase;
  readonly intensity: number;
  readonly cycle: number;
  readonly secondsRemaining: number;
}

const MIN_DURATION = 75;
const DURATION_SPAN = 105;

export class WeatherSystem {
  private elapsedInCycle = 0;
  private cycleValue = 0;
  private phaseValue: WeatherPhase;
  private durationValue: number;
  private readonly numericSeed: number;

  constructor(seed: string | number) {
    this.numericSeed = seedToUint32(seed);
    const initial = this.plan(0);
    this.phaseValue = initial.phase;
    this.durationValue = initial.duration;
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Weather delta must be finite and non-negative.');
    this.elapsedInCycle += dt;
    while (this.elapsedInCycle >= this.durationValue) {
      this.elapsedInCycle -= this.durationValue;
      this.cycleValue += 1;
      const next = this.plan(this.cycleValue);
      this.phaseValue = next.phase;
      this.durationValue = next.duration;
    }
  }

  get phase(): WeatherPhase { return this.phaseValue; }
  get intensity(): number {
    if (this.phaseValue === 'clear') return 0;
    const edge = Math.min(1, this.elapsedInCycle / 8, (this.durationValue - this.elapsedInCycle) / 8);
    return Math.max(0, edge) * (this.phaseValue === 'storm' ? 1 : 0.62);
  }
  get cycle(): number { return this.cycleValue; }
  get secondsRemaining(): number { return Math.max(0, this.durationValue - this.elapsedInCycle); }
  get snapshot(): WeatherSnapshot { return { phase: this.phaseValue, intensity: this.intensity, cycle: this.cycleValue, secondsRemaining: this.secondsRemaining }; }

  private plan(cycle: number): { readonly phase: WeatherPhase; readonly duration: number } {
    const phaseRoll = deterministicUnit2D(cycle, cycle ^ 0x5a17, this.numericSeed, 0x74e31d8b);
    const durationRoll = deterministicUnit2D(cycle, cycle ^ 0x2c91, this.numericSeed, 0x381ac4ef);
    const phase: WeatherPhase = phaseRoll < 0.58 ? 'clear' : phaseRoll < 0.88 ? 'rain' : 'storm';
    return { phase, duration: MIN_DURATION + durationRoll * DURATION_SPAN };
  }
}
