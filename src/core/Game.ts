import * as THREE from 'three';
import { BlockIds } from '../blocks/BlockRegistry';
import { createDefaultCraftingRegistry } from '../crafting/CraftingRegistry';
import { createPhaseFiveStarterInventory } from '../inventory/PlayerInventory';
import { createDefaultItemRegistry } from '../items/ItemRegistry';
import { createStack } from '../items/ItemStack';
import { breakDurationFor, miningSpeedFor } from '../items/ToolLogic';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { InventoryUI, type InventoryScreenMode } from '../ui/InventoryUI';
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
  private readonly items = createDefaultItemRegistry();
  private readonly inventory = createPhaseFiveStarterInventory(this.items);
  private readonly recipes = createDefaultCraftingRegistry(this.items);
  private readonly inventoryUI: InventoryUI;
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

    this.inventoryUI = new InventoryUI(root, this.inventory, this.items, this.recipes, () => this.closeInventory());
    this.input = new InputManager(this.hud.canvas);
    this.input.onLockChange = locked => {
      this.clock.reset();
      this.player.sync();
      this.breaker.reset();
      this.lastHit = null;
      this.world.setSelection(null);
      this.hud.setInteraction('');
      this.lastTime = undefined;
      this.hud.setPlaying(locked || this.inventoryUI.isOpen);
    };
    this.input.onError = message => this.hud.showMessage(message);
    this.input.onDebugToggle = () => this.hud.toggleDebug();
    this.input.onInventoryToggle = () => {
      if (this.inventoryUI.isOpen) this.closeInventory();
      else if (this.input.locked) this.openInventory('player');
    };
    this.input.onEscape = () => {
      if (this.inventoryUI.isOpen) this.closeInventory();
    };
    this.input.onHotbarSelect = index => {
      if (this.input.locked || this.inventoryUI.isOpen) this.inventoryUI.selectHotbar(index);
    };
    this.input.onHotbarCycle = delta => this.inventoryUI.cycleHotbar(delta);
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
      const selected = this.inventory.selectedStack;
      const selectedName = selected ? `${this.items.get(selected.itemId).name}${selected.count > 1 ? ` x${selected.count}` : ''}` : 'empty';
      this.hud.updateDebug([
        'Scraft V3 / Phase 5',
        `FPS ${(this.statsFrames / Math.max(this.statsTime, 0.001)).toFixed(0)}`,
        `XYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Chunk XZ ${splitCoordinate(p.x).chunk} / ${splitCoordinate(p.z).chunk}`,
        `Seed ${this.world.seed}`,
        `Render distance ${this.settings.renderDistance}`,
        `Chunks ${this.world.loadedChunkCount} loaded / ${this.world.pendingChunkCount} pending`,
        `Runtime edits ${this.world.runtimeEditCount}`,
        `Physics ${this.player.isGrounded ? 'grounded' : 'airborne'} / ${this.player.isCrouched ? 'crouched' : 'standing'} / fall ${this.player.fallDistance.toFixed(2)}`,
        `Hotbar ${this.inventory.selectedHotbarIndex + 1}: ${selectedName}`,
        `Target ${target}`,
        `Triangles ${info.render.triangles} | Draw calls ${info.render.calls}`,
        `GPU resources ${info.memory.geometries} geometries / ${info.memory.textures} textures`,
        'World: items + inventory + crafting on voxel physics terrain',
      ].join('\n'));
      this.statsTime = 0;
      this.statsFrames = 0;
    }

    this.frame = requestAnimationFrame(this.tick);
  };

  private updateVoxelInteraction(delta: number): void {
    if (!this.input.locked || this.inventoryUI.isOpen) {
      this.breaker.reset();
      this.lastHit = null;
      this.world.setSelection(null);
      this.hud.setInteraction('');
      return;
    }

    this.renderer.camera.getWorldDirection(this.lookDirection);
    const hit = this.world.raycast(this.renderer.camera.position, this.lookDirection);
    this.lastHit = hit;
    const selectedStack = this.inventory.selectedStack;
    const selectedItem = selectedStack ? this.items.get(selectedStack.itemId) : null;
    const targetBlock = hit ? this.world.blocks.get(hit.blockId) : null;
    const breakDuration = targetBlock ? breakDurationFor(targetBlock, selectedItem) : 0;
    const speed = targetBlock ? miningSpeedFor(targetBlock, selectedItem) : 1;
    const placePressed = this.input.consumeMousePress(2);

    if (placePressed && hit?.blockId === BlockIds.CRAFTING_TABLE) {
      this.openInventory('crafting-table');
      return;
    }

    const update = this.breaker.update(delta, this.input.isMouseDown(0), hit, breakDuration);
    this.world.setSelection(hit, update.progress);

    if (hit) {
      const block = this.world.blocks.get(hit.blockId);
      const percent = this.input.isMouseDown(0) ? ` / 破壊 ${Math.round(update.progress * 100)}%` : '';
      const toolText = selectedItem?.tool && speed > 1 ? ` / ${selectedItem.name}` : '';
      this.hud.setInteraction(`${block.name}${percent}${toolText}`);
    } else {
      this.hud.setInteraction('');
    }

    if (update.completed && hit) {
      const blockName = this.world.blocks.get(hit.blockId).name;
      if (this.world.breakBlock(hit)) {
        this.collectBlockDrop(hit.blockId);
        const durability = this.inventory.damageSelectedTool(this.items);
        if (durability.broken) this.hud.showMessage(`${selectedItem?.name ?? 'Tool'} が壊れました`);
        else this.hud.showMessage(`${blockName} を破壊しました`);
        this.inventoryUI.refresh();
      }
      this.lastHit = null;
      this.world.setSelection(null);
      return;
    }

    if (placePressed && hit) {
      if (!selectedStack || selectedItem?.placeBlockId === undefined) return;
      const placed = this.world.placeBlock(hit, selectedItem.placeBlockId, this.player.getBounds());
      if (placed) {
        this.inventory.consumeSelected(1, this.items);
        this.inventoryUI.refresh();
      } else {
        this.hud.showMessage('その位置にはブロックを設置できません。');
      }
    }
  }

  private collectBlockDrop(blockId: number): void {
    const itemId = this.items.getItemIdForBlock(blockId);
    if (itemId === undefined) return;
    const remainder = this.inventory.insert(createStack(this.items, itemId), this.items);
    if (remainder) this.hud.showMessage('インベントリが満杯のため、ブロックを回収できませんでした。');
  }

  private openInventory(mode: InventoryScreenMode): void {
    this.breaker.reset();
    this.lastHit = null;
    this.world.setSelection(null);
    this.hud.setInteraction('');
    this.inventoryUI.open(mode);
    this.hud.setPlaying(true);
    this.input.pause();
  }

  private closeInventory(): void {
    if (!this.inventoryUI.close()) {
      this.hud.showMessage('持っているアイテムを戻す空きがありません。');
      return;
    }
    this.hud.setPlaying(true);
    void this.input.lock().then(() => {
      if (!this.input.locked && !this.inventoryUI.isOpen) this.hud.setPlaying(false);
    });
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
    this.inventoryUI.dispose();
    this.world.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }
}
