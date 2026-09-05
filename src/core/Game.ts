import { FixedStep } from './FixedStep';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { loadSettings, saveSettings } from './Settings';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { splitCoordinate } from '../world/coordinates';

export class Game {
  private readonly hud: HUD;
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly player = new PlayerController();
  private readonly clock = new FixedStep();
  private settings = loadSettings();
  private frame = 0;
  private lastTime: number | undefined;
  private statsTime = 0;
  private statsFrames = 0;
  private disposed = false;
  private contextLost = false;

  constructor(root: HTMLElement) {
    this.hud = new HUD(root, this.settings, settings => {
      this.settings = settings;
      if (!saveSettings(settings)) this.hud.showMessage('設定を保存できません。この画面を開いている間は適用されます。');
    });

    try {
      this.renderer = new Renderer(this.hud.canvas, () => {
        this.contextLost = true;
        this.hud.fatal('描画接続が失われました。ページを再読み込みしてください。');
      });
    } catch (error) {
      this.hud.fatal(error instanceof Error ? error.message : '描画を初期化できません。');
      this.hud.dispose();
      throw error;
    }

    this.input = new InputManager(this.hud.canvas);
    this.input.onLockChange = locked => {
      this.clock.reset();
      this.player.sync();
      this.lastTime = undefined;
      this.hud.setPlaying(locked);
    };
    this.input.onError = message => this.hud.showMessage(message);
    this.input.onDebugToggle = () => this.hud.toggleDebug();
    this.hud.onStart(() => { void this.input.lock(); });

    document.addEventListener('visibilitychange', this.handleVisibility);
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (time: number): void => {
    if (this.disposed || this.contextLost) return;
    const elapsed = this.lastTime === undefined ? 0 : Math.max(0, (time - this.lastTime) / 1000);
    const delta = Math.min(0.1, elapsed);
    this.lastTime = time;

    const [dx, dy] = this.input.takeMouse();
    this.player.look(dx, dy, this.settings.sensitivity);
    const alpha = this.input.locked ? this.clock.advance(delta, dt => this.player.update(dt, this.input)) : 1;
    this.player.render(this.renderer.camera, alpha, delta, this.settings, this.input.locked);
    this.renderer.draw();

    this.statsTime += elapsed;
    this.statsFrames += 1;
    if (this.statsTime >= 0.5) {
      const p = this.player.position;
      const info = this.renderer.gl.info;
      this.hud.updateDebug([
        'Scraft V3 / Phase 1',
        `FPS ${(this.statsFrames / Math.max(this.statsTime, 0.001)).toFixed(0)}`,
        `XYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Chunk XZ ${splitCoordinate(p.x).chunk} / ${splitCoordinate(p.z).chunk}`,
        `Triangles ${info.render.triangles} | Draw calls ${info.render.calls}`,
        `GPU resources ${info.memory.geometries} geometries / ${info.memory.textures} textures`,
        'World: Phase 1 test floor | Seed/Biome/Loaded chunks: Phase 3',
      ].join('\n'));
      this.statsTime = 0;
      this.statsFrames = 0;
    }

    this.frame = requestAnimationFrame(this.tick);
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.input.pause();
    this.clock.reset();
    this.lastTime = undefined;
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.input.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }
}
