export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
const EXHAUSTION_PER_POINT = 4;
const REGEN_INTERVAL = 4;
const STARVATION_INTERVAL = 4;

export type DamageCause = 'fall' | 'starvation' | 'combat' | 'generic';

export interface SurvivalUpdate {
  readonly healed: number;
  readonly damaged: number;
  readonly damageCause: DamageCause | null;
}

export class SurvivalState {
  private healthValue = MAX_HEALTH;
  private hungerValue = MAX_HUNGER;
  private saturationValue = 5;
  private exhaustionValue = 0;
  private regenTimer = 0;
  private starvationTimer = 0;

  get health(): number { return this.healthValue; }
  get hunger(): number { return this.hungerValue; }
  get saturation(): number { return this.saturationValue; }
  get exhaustion(): number { return this.exhaustionValue; }
  get isDead(): boolean { return this.healthValue <= 0; }
  get canEat(): boolean { return this.hungerValue < MAX_HUNGER; }

  damage(amount: number, _cause: DamageCause = 'generic'): number {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Damage must be finite and non-negative.');
    const before = this.healthValue;
    this.healthValue = Math.max(0, this.healthValue - amount);
    return before - this.healthValue;
  }

  heal(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Heal amount must be finite and non-negative.');
    const before = this.healthValue;
    this.healthValue = Math.min(MAX_HEALTH, this.healthValue + amount);
    return this.healthValue - before;
  }

  eat(hunger: number, saturation: number): boolean {
    if (!Number.isFinite(hunger) || hunger <= 0 || !Number.isFinite(saturation) || saturation < 0) throw new RangeError('Invalid food values.');
    if (!this.canEat) return false;
    this.hungerValue = Math.min(MAX_HUNGER, this.hungerValue + hunger);
    this.saturationValue = Math.min(this.hungerValue, this.saturationValue + saturation);
    return true;
  }

  addExhaustion(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Exhaustion must be finite and non-negative.');
    this.exhaustionValue += amount;
    while (this.exhaustionValue >= EXHAUSTION_PER_POINT) {
      this.exhaustionValue -= EXHAUSTION_PER_POINT;
      if (this.saturationValue > 0) this.saturationValue = Math.max(0, this.saturationValue - 1);
      else if (this.hungerValue > 0) this.hungerValue -= 1;
    }
  }

  update(dt: number): SurvivalUpdate {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Survival delta must be finite and non-negative.');
    let healed = 0;
    let damaged = 0;
    let damageCause: DamageCause | null = null;

    if (this.healthValue < MAX_HEALTH && this.hungerValue >= 18) {
      this.regenTimer += dt;
      while (this.regenTimer >= REGEN_INTERVAL && this.healthValue < MAX_HEALTH && this.hungerValue >= 18) {
        this.regenTimer -= REGEN_INTERVAL;
        healed += this.heal(1);
        this.addExhaustion(6);
      }
    } else {
      this.regenTimer = 0;
    }

    if (this.hungerValue <= 0 && this.healthValue > 0) {
      this.starvationTimer += dt;
      while (this.starvationTimer >= STARVATION_INTERVAL && this.healthValue > 0) {
        this.starvationTimer -= STARVATION_INTERVAL;
        damaged += this.damage(1, 'starvation');
        damageCause = 'starvation';
      }
    } else {
      this.starvationTimer = 0;
    }
    return { healed, damaged, damageCause };
  }

  respawn(): void {
    this.healthValue = MAX_HEALTH;
    this.hungerValue = MAX_HUNGER;
    this.saturationValue = 5;
    this.exhaustionValue = 0;
    this.regenTimer = 0;
    this.starvationTimer = 0;
  }
}

export function fallDamageFor(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) throw new RangeError('Fall distance must be finite and non-negative.');
  return Math.max(0, Math.floor(distance - 3));
}
