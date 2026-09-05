import * as THREE from 'three';
import { BlockIds } from '../blocks/BlockRegistry';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { BlockBreaker } from '../world/BlockBreaker';
import type { VoxelHit } from '../world/VoxelRaycast';
import { VoxelWorld } from '../world/VoxelWorld';
import { splitCoordinate } from '../world/coordinates';
import { resolveWorldSeed } from '../world/WorldSeed';
import { FixedStep } from './FixedStep';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { loadSettings, saveSettings } from './Settings';

export class Game {
  private readonly hud: HUD;
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly player = new PlayerController();
  private readonly clock = new FixedStep();
  private readonly breaker = new BlockBreaker();
  private readonly lookDirection = new THREE.Vector3();
  private readonly world: VoxelWorld;
  private settings = loadSettings();
  private frame = 0;
  private lastTime: number | undefined;
  private statsTime = 0;
  private statsFrames = 0;
  private disposed = false;
  private contextLost = false;
  private lastHit: VoxelHit | null = null;

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
      this.world = new VoxelWorld(this.renderer.scene, {
        seed: resolveWorldSeed(),
        onGenerationError: message => this.hud.showMessage(message),
      });
      const spawnX = 0;
      const spawnZ = 6;
      this.world.ensurePhysicsNeighborhood(spawnX, spawnZ);
      this.player.teleportToFeet(spawnX, this.world.getSurfaceHeight(spawnX, spawnZ) + 1, spawnZ);
      this.world.updateStreaming(this.player.position.x, this.player.position.z, this.settings.renderDistance);
    } catch (error) {
      this.hud.fatal(error instanceof Error ? error.message : '描画を初期化できません。');
      this.hud.dispose();
      throw error;
    }

    this.input = new InputManager(this.hud.canvas);
    this.input.onLockChange = locked => {
      this.clock.reset();
      this.player.sync();
      this.breaker.reset();
      this.lastHit = null;
      this.world.setSelection(null);
      this.hud.setInteraction('');
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
    const alpha = this.input.locked ? this.clock.advance(delta, dt => {
      this.world.ensurePhysicsNeighborhood(this.player.position.x, this.player.position.z);
      this.player.update(dt, this.input, this.world);
    }) : 1;
    this.player.render(this.renderer.camera, alpha, delta, this.settings, this.input.locked);
    this.world.updateStreaming(this.player.position.x, this.player.position.z, this.settings.renderDistance);
    this.updateVoxelInteraction(delta);
    this.renderer.draw();

    this.statsTime += elapsed;
    this.statsFrames += 1;
    if (this.statsTime >= 0.5) {
      const p = this.player.position;
      const info = this.renderer.gl.info;
      const target = this.lastHit ? `${this.lastHit.x} / ${this.lastHit.y} / ${this.lastHit.z}` : 'none';
      this.hud.updateDebug([
        'Scraft V3 / Phase 4',
        `FPS ${(this.statsFrames / Math.max(this.statsTime, 0.001)).toFixed(0)}`,
        `XYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Chunk XZ ${splitCoordinate(p.x).chunk} / ${splitCoordinate(p.z).chunk}`,
        `Seed ${this.world.seed}`,
        `Render distance ${this.settings.renderDistance}`,
        `Chunks ${this.world.loadedChunkCount} loaded / ${this.world.pendingChunkCount} pending`,
        `Runtime edits ${this.world.runtimeEditCount}`,
        `Physics ${this.player.isGrounded ? 'grounded' : 'airborne'} / ${this.player.isCrouched ? 'crouched' : 'standing'} / fall ${this.player.fallDistance.toFixed(2)}`,
        `Target ${target}`,
        `Triangles ${info.render.triangles} | Draw calls ${info.render.calls}`,
        `GPU resources ${info.memory.geometries} geometries / ${info.memory.textures} textures`,
        'World: voxel AABB physics + deterministic streamed terrain',
      ].join('\n'));
      this.statsTime = 0;
      this.statsFrames = 0;
    }

    this.frame = requestAnimationFrame(this.tick);
  };

  private updateVoxelInteraction(delta: number): void {
    if (!this.input.locked) {
      this.breaker.reset();
      this.lastHit = null;
      this.world.setSelection(null);
      this.hud.setInteraction('');
      return;
    }

    this.renderer.camera.getWorldDirection(this.lookDirection);
    const hit = this.world.raycast(this.renderer.camera.position, this.lookDirection);
    this.lastHit = hit;
    const hardness = hit ? this.world.blocks.get(hit.blockId).hardness : 0;
    const placePressed = this.input.consumeMousePress(2);
    const update = this.breaker.update(delta, this.input.isMouseDown(0), hit, hardness);
    this.world.setSelection(hit, update.progress);

    if (hit) {
      const block = this.world.blocks.get(hit.blockId);
      const percent = this.input.isMouseDown(0) ? ` / 破壊 ${Math.round(update.progress * 100)}%` : '';
      this.hud.setInteraction(`${block.name}${percent}`);
    } else {
      this.hud.setInteraction('');
    }

    if (update.completed && hit) {
      if (this.world.breakBlock(hit)) this.hud.showMessage(`${this.world.blocks.get(hit.blockId).name} を破壊しました`);
      this.lastHit = null;
      this.world.setSelection(null);
      return;
    }

    if (placePressed && hit) {
      const placed = this.world.placeBlock(hit, BlockIds.DIRT, this.player.getBounds());
      if (!placed) this.hud.showMessage('その位置にはブロックを設置できません。');
    }
  }

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.input.pause();
    this.clock.reset();
    this.breaker.reset();
    this.lastTime = undefined;
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.input.dispose();
    this.world.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }
}
