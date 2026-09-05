import type { GameSettings } from '../core/Settings';
import { sanitizeSettings } from '../core/Settings';

export class HUD {
  readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly debug: HTMLPreElement;
  private readonly message: HTMLDivElement;
  private readonly interaction: HTMLDivElement;
  private readonly healthFill: HTMLSpanElement;
  private readonly hungerFill: HTMLSpanElement;
  private readonly healthText: HTMLSpanElement;
  private readonly hungerText: HTMLSpanElement;
  private readonly dayText: HTMLSpanElement;
  private startHandler?: () => void;
  private debugVisible = false;

  constructor(root: HTMLElement, settings: GameSettings, private readonly onSettingsChange: (settings: GameSettings) => void) {
    root.innerHTML = `
      <canvas class="game-canvas" aria-label="Scraft V3 game view"></canvas>
      <div class="crosshair" aria-hidden="true"></div>
      <div class="interaction-status" aria-live="polite"></div>
      <div class="survival-hud" aria-label="Survival status">
        <div class="survival-row"><span class="survival-label" data-health-text>HP 20/20</span><span class="survival-track health"><span data-health-fill></span></span></div>
        <div class="survival-row"><span class="survival-label" data-hunger-text>Hunger 20/20</span><span class="survival-track hunger"><span data-hunger-fill></span></span></div>
        <span class="day-status" data-day-text>Day 12:00</span>
      </div>
      <pre class="debug-panel" hidden></pre>
      <div class="message" hidden></div>
      <div class="overlay">
        <section class="menu-panel" aria-label="Game menu">
          <h1>Scraft V3</h1>
          <p class="subtitle">Phase 7 — Entities / Mobs / Projectiles</p>
          <button class="primary" data-action="start">ゲーム開始 / 再開</button>
          <div class="controls">WASD 移動 / Space ジャンプ / Ctrl ダッシュ / Shift しゃがみ / 1〜9・ホイール Hotbar / E Inventory / 左クリック Mob攻撃・破壊 / 右クリック 使用・設置 / F3 デバッグ</div>
          <details>
            <summary>設定</summary>
            <label>FOV <output data-output="fov"></output><input data-setting="fov" type="range" min="50" max="110" step="1"></label>
            <label>感度 <output data-output="sensitivity"></output><input data-setting="sensitivity" type="range" min="0.02" max="0.5" step="0.01"></label>
            <label>描画距離 <output data-output="renderDistance"></output><input data-setting="renderDistance" type="range" min="2" max="24" step="1"></label>
            <label class="checkbox"><input data-setting="viewBob" type="checkbox"> View Bob</label>
            <button data-action="fullscreen">フルスクリーン</button>
          </details>
        </section>
      </div>`;
    this.canvas = required(root.querySelector<HTMLCanvasElement>('.game-canvas'));
    this.overlay = required(root.querySelector<HTMLDivElement>('.overlay'));
    this.panel = required(root.querySelector<HTMLDivElement>('.menu-panel'));
    this.debug = required(root.querySelector<HTMLPreElement>('.debug-panel'));
    this.message = required(root.querySelector<HTMLDivElement>('.message'));
    this.interaction = required(root.querySelector<HTMLDivElement>('.interaction-status'));
    this.healthFill = required(root.querySelector<HTMLSpanElement>('[data-health-fill]'));
    this.hungerFill = required(root.querySelector<HTMLSpanElement>('[data-hunger-fill]'));
    this.healthText = required(root.querySelector<HTMLSpanElement>('[data-health-text]'));
    this.hungerText = required(root.querySelector<HTMLSpanElement>('[data-hunger-text]'));
    this.dayText = required(root.querySelector<HTMLSpanElement>('[data-day-text]'));
    const startButton = required(this.panel.querySelector<HTMLButtonElement>('[data-action="start"]'));
    startButton.addEventListener('click', () => this.startHandler?.());
    required(this.panel.querySelector<HTMLButtonElement>('[data-action="fullscreen"]')).addEventListener('click', () => {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => this.showMessage('フルスクリーンを開始できませんでした。'));
      else void document.exitFullscreen();
    });
    this.bindSettings(settings);
  }

  onStart(handler: () => void): void { this.startHandler = handler; }
  setPlaying(playing: boolean): void { this.overlay.hidden = playing; }
  setInteraction(text: string): void { this.interaction.textContent = text; this.interaction.hidden = text.length === 0; }
  toggleDebug(): void { this.debugVisible = !this.debugVisible; this.debug.hidden = !this.debugVisible; }
  updateDebug(text: string): void { this.debug.textContent = text; }

  updateSurvival(health: number, maxHealth: number, hunger: number, maxHunger: number): void {
    const hpRatio = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
    const hungerRatio = maxHunger > 0 ? Math.max(0, Math.min(1, hunger / maxHunger)) : 0;
    this.healthFill.style.width = `${hpRatio * 100}%`;
    this.hungerFill.style.width = `${hungerRatio * 100}%`;
    this.healthText.textContent = `HP ${Math.ceil(health)}/${maxHealth}`;
    this.hungerText.textContent = `Hunger ${Math.ceil(hunger)}/${maxHunger}`;
  }

  updateDayTime(phase: string, clock: string): void { this.dayText.textContent = `${phase} ${clock}`; }

  showMessage(text: string): void {
    this.message.textContent = text;
    this.message.hidden = false;
    window.setTimeout(() => { this.message.hidden = true; }, 3500);
  }

  fatal(text: string): void {
    this.overlay.hidden = false;
    this.panel.innerHTML = `<h1>Scraft V3</h1><p class="fatal"></p>`;
    required(this.panel.querySelector<HTMLParagraphElement>('.fatal')).textContent = text;
  }
  dispose(): void { this.startHandler = undefined; }

  private bindSettings(initial: GameSettings): void {
    let current = initial;
    for (const key of ['fov', 'sensitivity', 'renderDistance'] as const) {
      const input = required(this.panel.querySelector<HTMLInputElement>(`[data-setting="${key}"]`));
      const output = required(this.panel.querySelector<HTMLOutputElement>(`[data-output="${key}"]`));
      input.value = String(current[key]); output.value = String(current[key]);
      input.addEventListener('input', () => { current = sanitizeSettings({ ...current, [key]: Number(input.value) }); output.value = String(current[key]); this.onSettingsChange(current); });
    }
    const bob = required(this.panel.querySelector<HTMLInputElement>('[data-setting="viewBob"]'));
    bob.checked = current.viewBob;
    bob.addEventListener('change', () => { current = sanitizeSettings({ ...current, viewBob: bob.checked }); this.onSettingsChange(current); });
  }
}

function required<T>(value: T | null): T { if (value === null) throw new Error('Required UI element was not created.'); return value; }
