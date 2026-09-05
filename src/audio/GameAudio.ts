export type GameSound = 'break' | 'place' | 'hurt' | 'eat' | 'attack' | 'open' | 'close' | 'smelt' | 'pickup' | 'projectile' | 'mob';

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  async unlock(): Promise<void> {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume().catch(() => undefined);
  }

  play(sound: GameSound): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || context.state !== 'running') return;
    const profile = SOUND_PROFILES[sound];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, profile.endFrequency), context.currentTime + profile.duration);
    gain.gain.setValueAtTime(profile.gain, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + profile.duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + profile.duration);
  }

  dispose(): void {
    const context = this.context;
    this.context = null;
    this.master = null;
    if (context && context.state !== 'closed') void context.close();
  }
}

const SOUND_PROFILES: Record<GameSound, { readonly frequency: number; readonly endFrequency: number; readonly duration: number; readonly gain: number; readonly type: OscillatorType }> = {
  break: { frequency: 150, endFrequency: 80, duration: 0.07, gain: 0.25, type: 'square' },
  place: { frequency: 110, endFrequency: 90, duration: 0.05, gain: 0.2, type: 'triangle' },
  hurt: { frequency: 180, endFrequency: 70, duration: 0.14, gain: 0.32, type: 'sawtooth' },
  eat: { frequency: 420, endFrequency: 260, duration: 0.09, gain: 0.18, type: 'triangle' },
  attack: { frequency: 260, endFrequency: 120, duration: 0.06, gain: 0.2, type: 'square' },
  open: { frequency: 240, endFrequency: 360, duration: 0.08, gain: 0.13, type: 'sine' },
  close: { frequency: 350, endFrequency: 220, duration: 0.07, gain: 0.13, type: 'sine' },
  smelt: { frequency: 300, endFrequency: 420, duration: 0.12, gain: 0.1, type: 'triangle' },
  pickup: { frequency: 520, endFrequency: 760, duration: 0.07, gain: 0.11, type: 'sine' },
  projectile: { frequency: 380, endFrequency: 190, duration: 0.09, gain: 0.12, type: 'triangle' },
  mob: { frequency: 135, endFrequency: 105, duration: 0.11, gain: 0.13, type: 'square' },
};
