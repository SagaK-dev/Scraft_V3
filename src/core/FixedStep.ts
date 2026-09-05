export class FixedStep {
  private accumulator = 0;
  readonly step: number;
  readonly maxStepsPerFrame: number;

  constructor(step = 1 / 60, maxStepsPerFrame = 5) {
    if (!(step > 0) || !Number.isFinite(step)) throw new RangeError('step must be a positive finite number.');
    if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) throw new RangeError('maxStepsPerFrame must be a positive integer.');
    this.step = step;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  advance(deltaSeconds: number, update: (step: number) => void): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return this.accumulator / this.step;
    this.accumulator += Math.min(deltaSeconds, this.step * this.maxStepsPerFrame);

    let steps = 0;
    const epsilon = this.step * 1e-9;
    while (this.accumulator + epsilon >= this.step && steps < this.maxStepsPerFrame) {
      update(this.step);
      this.accumulator = Math.max(0, this.accumulator - this.step);
      steps += 1;
    }

    if (steps === this.maxStepsPerFrame && this.accumulator + epsilon >= this.step) {
      this.accumulator %= this.step;
    }
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
