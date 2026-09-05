export const DAY_LENGTH_SECONDS = 1200;

export class DayNightCycle {
  private timeValue: number;
  constructor(initialTime = 0.42) {
    if (!Number.isFinite(initialTime)) throw new RangeError('Initial day time must be finite.');
    this.timeValue = wrap01(initialTime);
  }
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Day/night delta must be finite and non-negative.');
    this.timeValue = wrap01(this.timeValue + dt / DAY_LENGTH_SECONDS);
  }
  get normalizedTime(): number { return this.timeValue; }
  get daylight(): number {
    const solar = Math.sin((this.timeValue - 0.25) * Math.PI * 2);
    return clamp01((solar + 0.18) / 1.18);
  }
  get clockText(): string {
    const totalMinutes = Math.floor(this.timeValue * 24 * 60) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  get phase(): 'Day' | 'Dawn' | 'Dusk' | 'Night' {
    const light = this.daylight;
    if (light >= 0.72) return 'Day';
    if (light <= 0.16) return 'Night';
    return this.timeValue < 0.5 ? 'Dawn' : 'Dusk';
  }
  setNormalizedTime(value: number): void {
    if (!Number.isFinite(value)) throw new RangeError('Day time must be finite.');
    this.timeValue = wrap01(value);
  }
}
function wrap01(value: number): number { return ((value % 1) + 1) % 1; }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
