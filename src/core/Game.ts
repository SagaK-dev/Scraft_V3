import * as THREE from 'three';
import { GameAudio } from '../audio/GameAudio';
import { BlockIds } from '../blocks/BlockRegistry';
import { MELEE_RANGE, MeleeCombat } from '../combat/MeleeCombat';
import { EntityManager } from '../entities/EntityManager';
import { knockbackVector } from '../entities/EntityMath';
import { BlockEntityStore } from '../containers/BlockEntityStore';
import { createDefaultCraftingRegistry } from '../crafting/CraftingRegistry';
import { createPhaseFiveStarterInventory } from '../inventory/PlayerInventory';
import { createDefaultItemRegistry } from '../items/ItemRegistry';
import { createStack } from '../items/ItemStack';
import { breakDurationFor, miningSpeedFor } from '../items/ToolLogic';
import { PlayerController } from '../player/PlayerController';
import { DayNightCycle } from '../survival/DayNightCycle';
import { MAX_HEALTH, MAX_HUNGER, SurvivalState, fallDamageFor } from '../survival/SurvivalState';
import { ContainerUI } from '../ui/ContainerUI';
import { HUD } from '../ui/HUD';
import { InventoryUI, type InventoryScreenMode } from '../ui/InventoryUI';
import { BlockBreaker } from '../world/BlockBreaker';
import type { VoxelHit } from '../world/VoxelRaycast';
import { VoxelWorld } from '../world/VoxelWorld';
import { WeatherSystem } from '../world/WeatherSystem';
import { splitCoordinate } from '../world/coordinates';
import { resolveWorldSeed } from '../world/WorldSeed';
import { FixedStep } from './FixedStep';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { loadSettings, saveSettings } from './Settings';

const SPAWN_X = 0;
const SPAWN_Z = 6;

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
  private readonly containerUI: ContainerUI;
  private readonly survival = new SurvivalState();
  private readonly dayNight = new DayNightCycle();
  private readonly weather: WeatherSystem;
  private readonly audio = new GameAudio();
  private readonly blockEntities = new BlockEntityStore();
  private readonly melee = new MeleeCombat();
  private readonly entities: EntityManager;
  private settings = loadSettings();
  private frame = 0;
  private lastTime: number | undefined;
  private statsTime = 0;
  private statsFrames = 0;
  private containerRefreshTimer = 0;
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
      this.world.ensurePhysicsNeighborhood(SPAWN_X, SPAWN_Z);
      this.player.teleportToFeet(SPAWN_X, this.world.getSafeSpawnFeetY(SPAWN_X, SPAWN_Z), SPAWN_Z);
      this.world.updateStreaming(this.player.position.x, this.player.position.z, this.settings.renderDistance);
      this.entities = new EntityManager(this.renderer.scene, this.world, this.items, this.world.seed);
      this.weather = new WeatherSystem(this.world.seed);
    } catch (error) {
      this.hud.fatal(error instanceof Error ? error.message : '描画を初期化できません。');
      this.hud.dispose();
      throw error;
    }

    this.inventoryUI = new InventoryUI(root, this.inventory, this.items, this.recipes, () => this.closeActiveUI());
    this.containerUI = new ContainerUI(root, this.inventory, this.items, () => this.closeActiveUI());
    this.input = new InputManager(this.hud.canvas);
    this.input.onLockChange = locked => {
      this.clock.reset();
      this.player.sync();
      this.breaker.reset();
      this.lastHit = null;
      this.world.setSelection(null);
      this.hud.setInteraction('');
      this.lastTime = undefined;
      this.hud.setPlaying(locked || this.anyUIOpen);
    };
    this.input.onError = message => this.hud.showMessage(message);
    this.input.onDebugToggle = () => this.hud.toggleDebug();
    this.input.onInventoryToggle = () => {
      if (this.anyUIOpen) this.closeActiveUI();
      else if (this.input.locked) this.openInventory('player');
    };
    this.input.onEscape = () => { if (this.anyUIOpen) this.closeActiveUI(); };
    this.input.onHotbarSelect = index => { if (this.input.locked || this.anyUIOpen) this.inventoryUI.selectHotbar(index); };
    this.input.onHotbarCycle = delta => this.inventoryUI.cycleHotbar(delta);
    this.hud.onStart(() => { void this.audio.unlock(); void this.input.lock(); });

    document.addEventListener('visibilitychange', this.handleVisibility);
    this.updateHudStatus();
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (time: number): void => {
    if (this.disposed || this.contextLost) return;
    const elapsed = this.lastTime === undefined ? 0 : Math.max(0, (time - this.lastTime) / 1000);
    const delta = Math.min(0.1, elapsed);
    this.lastTime = time;

    const [dx, dy] = this.input.takeMouse();
    this.player.look(dx, dy, this.settings.sensitivity);
    const alpha = this.input.locked && !this.anyUIOpen ? this.clock.advance(delta, dt => this.updateFixed(dt)) : 1;
    this.player.render(this.renderer.camera, alpha, delta, this.settings, this.input.locked && !this.anyUIOpen);

    this.blockEntities.update(delta, this.items);
    this.dayNight.update(delta);
    this.weather.update(delta);
    this.melee.update(delta);
    this.renderer.applyDayNight(this.dayNight.normalizedTime, this.dayNight.daylight);
    this.renderer.applyWeather(this.weather.phase, this.weather.intensity, time / 1000, this.player.position);
    this.world.updateStreaming(this.player.position.x, this.player.position.z, this.settings.renderDistance);
    this.updateVoxelInteraction(delta);
    this.refreshContainerUi(delta);
    this.updateHudStatus();
    this.renderer.draw();

    this.statsTime += elapsed;
    this.statsFrames += 1;
    if (this.statsTime >= 0.5) this.updateDebug();
    this.frame = requestAnimationFrame(this.tick);
  };

  private updateFixed(dt: number): void {
    this.world.ensurePhysicsNeighborhood(this.player.position.x, this.player.position.z);
    this.player.update(dt, this.input, this.world);
    const horizontalSpeed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    if (horizontalSpeed > 0.1 && !this.player.isSubmerged) {
      const sprinting = !this.player.isCrouched && (this.input.isDown('ControlLeft') || this.input.isDown('ControlRight'));
      this.survival.addExhaustion(horizontalSpeed * dt * (sprinting ? 0.03 : 0.005));
    }

    const landed = this.player.consumeLandedFallDistance();
    if (landed > 0) {
      const damage = fallDamageFor(landed);
      if (damage > 0) {
        this.survival.damage(damage, 'fall');
        this.audio.play('hurt');
        this.hud.showMessage(`落下ダメージ ${damage}`);
      }
    }
    this.entities.update(dt, this.player.position, this.player.getBounds(), this.dayNight.daylight, {
      tryPickup: stack => this.inventory.insert(stack, this.items),
      onPickup: stack => {
        this.audio.play('pickup');
        this.inventoryUI.refresh();
        this.hud.showMessage(`${this.items.get(stack.itemId).name} x${stack.count} を拾いました`);
      },
      onPlayerDamage: (damage, source) => this.damagePlayerFromEntity(damage, source),
    });

    const survivalUpdate = this.survival.update(dt);
    if (survivalUpdate.damaged > 0) this.audio.play('hurt');
    if (this.survival.isDead) this.respawnPlayer();
  }

  private updateVoxelInteraction(delta: number): void {
    if (!this.input.locked || this.anyUIOpen) {
      this.breaker.reset();
      this.lastHit = null;
      this.world.setSelection(null);
      this.hud.setInteraction('');
      return;
    }

    this.renderer.camera.getWorldDirection(this.lookDirection);
    const hit = this.world.raycast(this.renderer.camera.position, this.lookDirection);
    const mobHit = this.entities.raycastMobs(this.renderer.camera.position, this.lookDirection, MELEE_RANGE);
    if (mobHit && (!hit || mobHit.distance < hit.distance)) {
      this.lastHit = null;
      this.world.setSelection(null);
      this.breaker.reset();
      this.hud.setInteraction(`${mobHit.name} HP ${mobHit.health.toFixed(1)}/${mobHit.maxHealth}`);
      if (this.input.consumeMousePress(0)) this.attackMob(mobHit.id);
      return;
    }

    this.lastHit = hit;
    const selectedStack = this.inventory.selectedStack;
    const selectedItem = selectedStack ? this.items.get(selectedStack.itemId) : null;
    const targetBlock = hit ? this.world.blocks.get(hit.blockId) : null;
    const breakDuration = targetBlock ? breakDurationFor(targetBlock, selectedItem) : 0;
    const speed = targetBlock ? miningSpeedFor(targetBlock, selectedItem) : 1;
    const usePressed = this.input.consumeMousePress(2);

    if (usePressed && hit) {
      if (hit.blockId === BlockIds.CRAFTING_TABLE) { this.openInventory('crafting-table'); return; }
      if (hit.blockId === BlockIds.CHEST) { this.openChest(hit); return; }
      if (hit.blockId === BlockIds.FURNACE) { this.openFurnace(hit); return; }
    }

    if (usePressed && selectedStack && selectedItem?.food && this.survival.canEat) {
      if (this.survival.eat(selectedItem.food.hunger, selectedItem.food.saturation)) {
        this.inventory.consumeSelected(1, this.items);
        this.inventoryUI.refresh();
        this.audio.play('eat');
        this.hud.showMessage(`${selectedItem.name} を食べました`);
      }
      return;
    }

    const update = this.breaker.update(delta, this.input.isMouseDown(0), hit, breakDuration);
    this.world.setSelection(hit, update.progress);
    if (hit) {
      const block = this.world.blocks.get(hit.blockId);
      const percent = this.input.isMouseDown(0) ? ` / 破壊 ${Math.round(update.progress * 100)}%` : '';
      const toolText = selectedItem?.tool && speed > 1 ? ` / ${selectedItem.name}` : '';
      this.hud.setInteraction(`${block.name}${percent}${toolText}`);
    } else this.hud.setInteraction('');

    if (update.completed && hit) {
      const blockName = this.world.blocks.get(hit.blockId).name;
      if (this.world.breakBlock(hit)) {
        const contents = this.blockEntities.extractAt(hit.x, hit.y, hit.z);
        if (contents.length > 0) this.entities.spawnDrops(contents, hit.x + 0.5, hit.y + 0.8, hit.z + 0.5);
        this.spawnBlockDrop(hit.blockId, hit.x, hit.y, hit.z);
        const durability = this.inventory.damageSelectedTool(this.items);
        if (durability.broken) this.hud.showMessage(`${selectedItem?.name ?? 'Tool'} が壊れました`);
        else this.hud.showMessage(`${blockName} を破壊しました`);
        this.audio.play('break');
        this.inventoryUI.refresh();
      }
      this.lastHit = null;
      this.world.setSelection(null);
      return;
    }

    if (usePressed && hit) {
      if (!selectedStack || selectedItem?.placeBlockId === undefined) return;
      const placed = this.world.placeBlock(hit, selectedItem.placeBlockId, this.player.getBounds());
      if (placed) {
        this.inventory.consumeSelected(1, this.items);
        this.inventoryUI.refresh();
        this.audio.play('place');
      } else this.hud.showMessage('その位置にはブロックを設置できません。');
    }
  }

  private attackMob(id: number): void {
    const stack = this.inventory.selectedStack;
    const item = stack ? this.items.get(stack.itemId) : null;
    const attack = this.melee.tryAttack(item);
    if (!attack.attacked) return;
    const result = this.entities.damageMob(id, attack.damage, this.player.position);
    if (!result.damaged) return;
    this.audio.play(result.killed ? 'mob' : 'attack');
    if (item?.tool) this.inventory.damageSelectedTool(this.items);
    this.inventoryUI.refresh();
    this.hud.showMessage(result.killed ? `${result.kind === 'grazer' ? 'Grazer' : 'Stalker'} を倒しました` : `攻撃 ${attack.damage.toFixed(1)} damage`);
  }

  private spawnBlockDrop(blockId: number, x: number, y: number, z: number): void {
    const itemId = this.items.getItemIdForBlock(blockId);
    if (itemId === undefined) return;
    this.entities.spawnItemDrop(createStack(this.items, itemId), x + 0.5, y + 0.65, z + 0.5);
  }

  private damagePlayerFromEntity(damage: number, source: { readonly x: number; readonly y: number; readonly z: number }): void {
    const applied = this.survival.damage(damage, 'combat');
    if (applied <= 0) return;
    const knockback = knockbackVector(source, this.player.position, 4.1, 3.0);
    this.player.applyImpulse(knockback.x, knockback.y, knockback.z);
    this.audio.play('hurt');
    this.hud.showMessage(`Mobから ${applied.toFixed(1)} damage`);
  }

  private openInventory(mode: InventoryScreenMode): void {
    this.prepareUiOpen();
    this.inventoryUI.open(mode);
    this.hud.setPlaying(true);
    this.input.pause();
  }

  private openChest(hit: VoxelHit): void {
    this.prepareUiOpen();
    this.containerUI.openChest(this.blockEntities.getChest(hit.x, hit.y, hit.z));
    this.hud.setPlaying(true);
    this.input.pause();
    this.audio.play('open');
  }

  private openFurnace(hit: VoxelHit): void {
    this.prepareUiOpen();
    this.containerUI.openFurnace(this.blockEntities.getFurnace(hit.x, hit.y, hit.z));
    this.hud.setPlaying(true);
    this.input.pause();
    this.audio.play('open');
  }

  private prepareUiOpen(): void {
    this.breaker.reset();
    this.lastHit = null;
    this.world.setSelection(null);
    this.hud.setInteraction('');
  }

  private closeActiveUI(): void {
    const inventoryWasOpen = this.inventoryUI.isOpen;
    const containerWasOpen = this.containerUI.isOpen;
    if (inventoryWasOpen && !this.inventoryUI.close()) { this.hud.showMessage('持っているアイテムを戻す空きがありません。'); return; }
    if (containerWasOpen && !this.containerUI.close()) { this.hud.showMessage('持っているアイテムを戻す空きがありません。'); return; }
    if (containerWasOpen) this.audio.play('close');
    this.hud.setPlaying(true);
    void this.input.lock().then(() => { if (!this.input.locked && !this.anyUIOpen) this.hud.setPlaying(false); });
  }

  private refreshContainerUi(delta: number): void {
    if (!this.containerUI.isOpen) { this.containerRefreshTimer = 0; return; }
    this.containerRefreshTimer += delta;
    if (this.containerRefreshTimer >= 0.2) { this.containerRefreshTimer = 0; this.containerUI.refresh(); }
  }

  private updateHudStatus(): void {
    this.hud.updateSurvival(this.survival.health, MAX_HEALTH, this.survival.hunger, MAX_HUNGER);
    this.hud.updateDayTime(this.dayNight.phase, this.dayNight.clockText, this.weather.phase);
  }

  private updateDebug(): void {
    const p = this.player.position;
    const info = this.renderer.gl.info;
    const target = this.lastHit ? `${this.lastHit.x} / ${this.lastHit.y} / ${this.lastHit.z}` : 'none';
    const selected = this.inventory.selectedStack;
    const selectedName = selected ? `${this.items.get(selected.itemId).name}${selected.count > 1 ? ` x${selected.count}` : ''}` : 'empty';
    this.hud.updateDebug([
      'Scraft V3 / Phase 8',
      `FPS ${(this.statsFrames / Math.max(this.statsTime, 0.001)).toFixed(0)}`,
      `XYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
      `Chunk XZ ${splitCoordinate(p.x).chunk} / ${splitCoordinate(p.z).chunk}`,
      `Biome ${this.world.getBiome(p.x, p.z)}`,
      `Seed ${this.world.seed}`,
      `Render distance ${this.settings.renderDistance}`,
      `Chunks ${this.world.loadedChunkCount} loaded / ${this.world.pendingChunkCount} pending`,
      `Runtime edits ${this.world.runtimeEditCount} | Block entities ${this.blockEntities.size}`,
      `Entities ${this.entities.entityCount} | Mobs ${this.entities.passiveCount} passive / ${this.entities.hostileCount} hostile | Drops ${this.entities.itemDropCount} | Projectiles ${this.entities.projectileCount}`,
      `Physics ${this.player.isGrounded ? 'grounded' : 'airborne'} / ${this.player.isCrouched ? 'crouched' : 'standing'} / ${this.player.isSubmerged ? 'water' : 'dry'} / fall ${this.player.fallDistance.toFixed(2)}`,
      `Survival HP ${this.survival.health.toFixed(1)}/${MAX_HEALTH} | Hunger ${this.survival.hunger.toFixed(1)}/${MAX_HUNGER} | Sat ${this.survival.saturation.toFixed(1)}`,
      `Time ${this.dayNight.phase} ${this.dayNight.clockText} | daylight ${this.dayNight.daylight.toFixed(2)} | weather ${this.weather.phase} ${Math.round(this.weather.intensity * 100)}%`,
      `Hotbar ${this.inventory.selectedHotbarIndex + 1}: ${selectedName}`,
      `Target ${target}`,
      `Triangles ${info.render.triangles} | Draw calls ${info.render.calls}`,
      `GPU resources ${info.memory.geometries} geometries / ${info.memory.textures} textures`,
    ].join('\n'));
    this.statsTime = 0;
    this.statsFrames = 0;
  }

  private respawnPlayer(): void {
    this.world.ensurePhysicsNeighborhood(SPAWN_X, SPAWN_Z);
    this.player.teleportToFeet(SPAWN_X, this.world.getSafeSpawnFeetY(SPAWN_X, SPAWN_Z), SPAWN_Z);
    this.survival.respawn();
    this.breaker.reset();
    this.hud.showMessage('HPが0になったためスポーン地点へ戻りました。');
  }

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.input.pause();
    this.clock.reset();
    this.breaker.reset();
    this.lastTime = undefined;
  };

  private get anyUIOpen(): boolean { return this.inventoryUI.isOpen || this.containerUI.isOpen; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.input.dispose();
    this.inventoryUI.dispose();
    this.containerUI.dispose();
    this.entities.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }
}
