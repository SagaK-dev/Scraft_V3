import * as THREE from 'three';
import type { AABB } from '../player/aabb.ts';
import { createAABB, moveAABB } from '../player/VoxelPhysics.ts';
import { moveTowards } from '../player/movement.ts';
import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { ItemIds } from '../items/ItemRegistry.ts';
import { createStack, type ItemStack } from '../items/ItemStack.ts';
import type { VoxelWorld } from '../world/VoxelWorld.ts';
import { seedToUint32 } from '../world/SeededNoise.ts';
import { distanceSquared, horizontalDistanceSquared, knockbackVector } from './EntityMath.ts';
import { ItemDropManager } from './ItemDropManager.ts';
import { decideHostileAction } from './MobAI.ts';
import { ProjectileRuntime } from './ProjectileRuntime.ts';
import { findSimplePath, type NavigationPoint } from './SimplePathfinder.ts';
import { planMobSpawns, shouldDespawnMob } from './SpawnRules.ts';
import { MOB_DEFINITIONS, type MobDamageResult, type MobHit, type MobKind, type Vec3Like } from './EntityTypes.ts';

const MOB_GRAVITY = -20;
const MOB_TERMINAL_VELOCITY = -45;
const MOB_STEP_HEIGHT = 1.001;
const MOB_ACCELERATION = 9;
const MOB_REPATH_INTERVAL = 0.65;
const SPAWN_INTERVAL = 2;
const HOSTILE_MELEE_COOLDOWN = 1.2;
const HOSTILE_PROJECTILE_COOLDOWN = 3.2;

interface MobRuntime {
  readonly id: number;
  readonly kind: MobKind;
  readonly root: THREE.Group;
  readonly material: THREE.MeshLambertMaterial;
  readonly position: THREE.Vector3;
  readonly horizontalVelocity: THREE.Vector2;
  readonly knockback: THREE.Vector2;
  health: number;
  verticalVelocity: number;
  grounded: boolean;
  path: NavigationPoint[];
  pathIndex: number;
  repathTimer: number;
  attackCooldown: number;
  projectileCooldown: number;
  wanderTimer: number;
  wanderCycle: number;
  wanderTarget: THREE.Vector3 | null;
  fleeTimer: number;
  flashTimer: number;
}

export interface EntityUpdateHooks {
  readonly tryPickup: (stack: ItemStack) => ItemStack | null;
  readonly onPickup?: (stack: ItemStack) => void;
  readonly onPlayerDamage: (damage: number, source: Vec3Like) => void;
}

export class EntityManager {
  private readonly root = new THREE.Group();
  private readonly mobs = new Map<number, MobRuntime>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly seed: number;
  private readonly drops: ItemDropManager;
  private readonly projectileRuntime: ProjectileRuntime;
  private nextMobId = 1;
  private spawnTimer = 0.35;
  private spawnCycle = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: VoxelWorld,
    private readonly itemRegistry: ItemRegistry,
    worldSeed: string,
  ) {
    this.seed = seedToUint32(worldSeed);
    this.root.name = 'phase7-entities';
    scene.add(this.root);
    this.drops = new ItemDropManager(this.root, world, itemRegistry, this.seed);
    this.projectileRuntime = new ProjectileRuntime(this.root, world);
  }

  update(dt: number, playerPosition: Vec3Like, playerBounds: AABB, daylight: number, hooks: EntityUpdateHooks): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Entity delta must be finite and non-negative.');
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += SPAWN_INTERVAL;
      this.runSpawnCycle(playerPosition, daylight);
    }
    this.updateMobs(dt, playerPosition, hooks);
    this.projectileRuntime.update(dt, playerBounds, hooks.onPlayerDamage);
    this.drops.update(dt, playerBounds, { tryPickup: hooks.tryPickup, onPickup: hooks.onPickup });
  }

  spawnItemDrop(stack: ItemStack, x: number, y: number, z: number, velocity?: Vec3Like): number {
    return this.drops.spawn(stack, x, y, z, velocity);
  }

  spawnDrops(stacks: readonly ItemStack[], x: number, y: number, z: number): void {
    this.drops.spawnMany(stacks, x, y, z);
  }

  raycastMobs(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): MobHit | null {
    if (!Number.isFinite(maxDistance) || maxDistance < 0) throw new RangeError('Mob raycast distance must be non-negative.');
    if (this.mobs.size === 0) return null;
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0;
    this.raycaster.far = maxDistance;
    const intersection = this.raycaster.intersectObjects([...this.mobs.values()].map(mob => mob.root), true)[0];
    if (!intersection) return null;
    let object: THREE.Object3D | null = intersection.object;
    let id: number | undefined;
    while (object && id === undefined) {
      const value = object.userData.entityId;
      if (typeof value === 'number') id = value;
      object = object.parent;
    }
    if (id === undefined) return null;
    const mob = this.mobs.get(id);
    if (!mob) return null;
    const definition = MOB_DEFINITIONS[mob.kind];
    return { id, kind: mob.kind, name: definition.name, distance: intersection.distance, health: mob.health, maxHealth: definition.maxHealth };
  }

  damageMob(id: number, amount: number, source: Vec3Like): MobDamageResult {
    if (!Number.isFinite(amount) || amount <= 0) return { damaged: false, killed: false, health: 0, kind: null };
    const mob = this.mobs.get(id);
    if (!mob) return { damaged: false, killed: false, health: 0, kind: null };
    mob.health = Math.max(0, mob.health - amount);
    mob.flashTimer = 0.14;
    mob.material.emissive.setHex(0x5b1515);
    const knock = knockbackVector(source, mob.position, 4.2, 0.32);
    mob.knockback.x += knock.x;
    mob.knockback.y += knock.z;
    mob.verticalVelocity = Math.max(mob.verticalVelocity, knock.y * 7);
    if (mob.kind === 'grazer') mob.fleeTimer = 4;
    const killed = mob.health <= 0;
    const kind = mob.kind;
    if (killed) this.killMob(mob);
    return { damaged: true, killed, health: Math.max(0, mob.health), kind };
  }

  get entityCount(): number { return this.mobs.size + this.drops.size + this.projectileRuntime.size; }
  get mobCount(): number { return this.mobs.size; }
  get passiveCount(): number { return [...this.mobs.values()].filter(mob => mob.kind === 'grazer').length; }
  get hostileCount(): number { return [...this.mobs.values()].filter(mob => mob.kind === 'stalker').length; }
  get itemDropCount(): number { return this.drops.size; }
  get projectileCount(): number { return this.projectileRuntime.size; }

  dispose(): void {
    this.scene.remove(this.root);
    for (const mob of this.mobs.values()) mob.material.dispose();
    this.mobs.clear();
    this.drops.dispose();
    this.projectileRuntime.dispose();
    this.unitBox.dispose();
  }

  private runSpawnCycle(player: Vec3Like, daylight: number): void {
    const candidates = planMobSpawns({
      seed: this.seed,
      cycle: this.spawnCycle++,
      playerX: player.x,
      playerZ: player.z,
      daylight: Math.max(0, Math.min(1, daylight)),
      passiveCount: this.passiveCount,
      hostileCount: this.hostileCount,
    });
    for (const candidate of candidates) {
      const surfaceGuess = this.world.getSurfaceHeight(candidate.x, candidate.z) + 1;
      const feetY = this.sampleStandY(Math.floor(candidate.x), Math.floor(candidate.z), surfaceGuess);
      if (feetY === null) continue;
      if (Math.abs(feetY - player.y) > 10) continue;
      if (this.nearExistingMob(candidate.x, feetY, candidate.z, 2.5)) continue;
      this.spawnMob(candidate.kind, candidate.x, feetY, candidate.z);
    }
  }

  private spawnMob(kind: MobKind, x: number, feetY: number, z: number): number {
    const definition = MOB_DEFINITIONS[kind];
    const id = this.nextMobId++;
    const material = new THREE.MeshLambertMaterial({ color: definition.color });
    const root = new THREE.Group();
    root.name = `mob-${kind}-${id}`;
    root.userData.entityId = id;
    const body = new THREE.Mesh(this.unitBox, material);
    body.scale.set(definition.width, definition.height * 0.68, definition.width * 0.75);
    body.position.y = definition.height * 0.34;
    body.userData.entityId = id;
    const head = new THREE.Mesh(this.unitBox, material);
    head.scale.set(definition.width * 0.72, definition.height * 0.34, definition.width * 0.72);
    head.position.y = definition.height * 0.83;
    head.userData.entityId = id;
    root.add(body, head);
    root.position.set(x, feetY, z);
    this.root.add(root);
    const mob: MobRuntime = {
      id, kind, root, material, position: root.position,
      horizontalVelocity: new THREE.Vector2(), knockback: new THREE.Vector2(),
      health: definition.maxHealth, verticalVelocity: 0, grounded: false,
      path: [], pathIndex: 0, repathTimer: 0, attackCooldown: 0, projectileCooldown: 1.2,
      wanderTimer: 0, wanderCycle: 0, wanderTarget: null, fleeTimer: 0, flashTimer: 0,
    };
    this.mobs.set(id, mob);
    return id;
  }

  private updateMobs(dt: number, player: Vec3Like, hooks: EntityUpdateHooks): void {
    for (const mob of [...this.mobs.values()]) {
      const playerDistance = Math.sqrt(horizontalDistanceSquared(mob.position, player));
      if (shouldDespawnMob(playerDistance)) {
        this.removeMob(mob);
        continue;
      }
      mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);
      mob.projectileCooldown = Math.max(0, mob.projectileCooldown - dt);
      mob.repathTimer = Math.max(0, mob.repathTimer - dt);
      mob.wanderTimer = Math.max(0, mob.wanderTimer - dt);
      mob.fleeTimer = Math.max(0, mob.fleeTimer - dt);
      if (mob.flashTimer > 0) {
        mob.flashTimer = Math.max(0, mob.flashTimer - dt);
        if (mob.flashTimer === 0) mob.material.emissive.setHex(0x000000);
      }
      const desired = mob.kind === 'stalker'
        ? this.hostileDesiredVelocity(mob, player, playerDistance, hooks)
        : this.passiveDesiredVelocity(mob, player);
      this.moveMob(mob, desired.x, desired.z, dt);
      if (desired.x !== 0 || desired.z !== 0) mob.root.rotation.y = Math.atan2(desired.x, desired.z);
    }
  }

  private passiveDesiredVelocity(mob: MobRuntime, player: Vec3Like): { x: number; z: number } {
    const definition = MOB_DEFINITIONS[mob.kind];
    if (mob.fleeTimer > 0) {
      const dx = mob.position.x - player.x;
      const dz = mob.position.z - player.z;
      const length = Math.hypot(dx, dz) || 1;
      return { x: dx / length * definition.speed * 1.35, z: dz / length * definition.speed * 1.35 };
    }
    if (!mob.wanderTarget || mob.wanderTimer <= 0 || horizontalDistanceSquared(mob.position, mob.wanderTarget) < 0.5) {
      const angle = deterministicUnit(this.seed, mob.id, mob.wanderCycle++, 1) * Math.PI * 2;
      const radius = 4 + deterministicUnit(this.seed, mob.id, mob.wanderCycle, 2) * 6;
      mob.wanderTarget = new THREE.Vector3(mob.position.x + Math.cos(angle) * radius, mob.position.y, mob.position.z + Math.sin(angle) * radius);
      mob.wanderTimer = 3.5 + deterministicUnit(this.seed, mob.id, mob.wanderCycle, 3) * 4;
      this.rebuildPath(mob, mob.wanderTarget);
    } else if (mob.repathTimer <= 0 && mob.pathIndex >= mob.path.length) {
      this.rebuildPath(mob, mob.wanderTarget);
    }
    return this.followPath(mob, definition.speed * 0.65);
  }

  private hostileDesiredVelocity(mob: MobRuntime, player: Vec3Like, distance: number, hooks: EntityUpdateHooks): { x: number; z: number } {
    const definition = MOB_DEFINITIONS[mob.kind];
    const lineOfSight = distance <= 10 && this.hasLineOfSight(mob.position, player);
    const decision = decideHostileAction(
      definition, distance, Math.abs(player.y - mob.position.y), mob.attackCooldown <= 0, mob.projectileCooldown <= 0, lineOfSight,
    );
    const engaged = distance <= definition.detectionRange && Math.abs(player.y - mob.position.y) < 7;
    if (engaged) {
      if (decision.shouldMelee) {
        mob.attackCooldown = HOSTILE_MELEE_COOLDOWN;
        hooks.onPlayerDamage(definition.meleeDamage, mob.position);
      }
      if (decision.shouldShoot) {
        mob.projectileCooldown = HOSTILE_PROJECTILE_COOLDOWN;
        this.projectileRuntime.fireHostile({ x: mob.position.x, y: mob.position.y + MOB_DEFINITIONS[mob.kind].height * 0.72, z: mob.position.z }, player);
      }
      if (decision.shouldChase) {
        if (mob.repathTimer <= 0) this.rebuildPath(mob, player);
        const pathVelocity = this.followPath(mob, definition.speed);
        if (pathVelocity.x !== 0 || pathVelocity.z !== 0) return pathVelocity;
        const dx = player.x - mob.position.x;
        const dz = player.z - mob.position.z;
        const length = Math.hypot(dx, dz) || 1;
        return { x: dx / length * definition.speed * 0.8, z: dz / length * definition.speed * 0.8 };
      }
      return { x: 0, z: 0 };
    }
    return this.passiveDesiredVelocity(mob, player);
  }

  private rebuildPath(mob: MobRuntime, target: Vec3Like): void {
    mob.repathTimer = MOB_REPATH_INTERVAL;
    mob.path = findSimplePath(
      { x: mob.position.x, y: mob.position.y, z: mob.position.z },
      { x: target.x, y: target.y, z: target.z },
      (x, z, fromY) => this.sampleStandY(x, z, fromY),
      { maxNodes: 112, maxPathLength: 28 },
    );
    mob.pathIndex = 0;
  }

  private followPath(mob: MobRuntime, speed: number): { x: number; z: number } {
    while (mob.pathIndex < mob.path.length) {
      const waypoint = mob.path[mob.pathIndex];
      if (!waypoint) break;
      const dx = waypoint.x - mob.position.x;
      const dz = waypoint.z - mob.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.28) { mob.pathIndex += 1; continue; }
      return { x: dx / distance * speed, z: dz / distance * speed };
    }
    return { x: 0, z: 0 };
  }

  private moveMob(mob: MobRuntime, desiredX: number, desiredZ: number, dt: number): void {
    mob.horizontalVelocity.x = moveTowards(mob.horizontalVelocity.x, desiredX, MOB_ACCELERATION * dt);
    mob.horizontalVelocity.y = moveTowards(mob.horizontalVelocity.y, desiredZ, MOB_ACCELERATION * dt);
    mob.verticalVelocity = Math.max(MOB_TERMINAL_VELOCITY, mob.verticalVelocity + MOB_GRAVITY * dt);
    const definition = MOB_DEFINITIONS[mob.kind];
    const bounds = createAABB(mob.position.x, mob.position.y, mob.position.z, definition.width / 2, definition.height);
    const motion = moveAABB(bounds, {
      x: (mob.horizontalVelocity.x + mob.knockback.x) * dt,
      y: mob.verticalVelocity * dt,
      z: (mob.horizontalVelocity.y + mob.knockback.y) * dt,
    }, this.world, { stepHeight: MOB_STEP_HEIGHT, allowStep: mob.grounded, keepSupported: false });
    mob.position.x = (motion.bounds.minX + motion.bounds.maxX) / 2;
    mob.position.y = motion.bounds.minY;
    mob.position.z = (motion.bounds.minZ + motion.bounds.maxZ) / 2;
    mob.grounded = motion.grounded;
    if (motion.hitX) { mob.horizontalVelocity.x = 0; mob.knockback.x = 0; mob.repathTimer = 0; }
    if (motion.hitZ) { mob.horizontalVelocity.y = 0; mob.knockback.y = 0; mob.repathTimer = 0; }
    if ((motion.grounded && mob.verticalVelocity < 0) || (motion.hitCeiling && mob.verticalVelocity > 0)) mob.verticalVelocity = 0;
    const damping = Math.max(0, 1 - 5.5 * dt);
    mob.knockback.multiplyScalar(damping);
  }

  private sampleStandY(x: number, z: number, fromY: number): number | null {
    const base = Math.floor(fromY + 1e-6);
    for (let offset = 1; offset >= -2; offset -= 1) {
      const feetY = base + offset;
      if (!this.world.isSolidBlock(x, feetY - 1, z)) continue;
      if (this.world.isSolidBlock(x, feetY, z)) continue;
      if (this.world.isSolidBlock(x, feetY + 1, z)) continue;
      return feetY;
    }
    return null;
  }

  private hasLineOfSight(from: Vec3Like, to: Vec3Like): boolean {
    const dx = to.x - from.x;
    const dy = to.y - (from.y + 0.8);
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 1e-9) return true;
    const hit = this.world.raycast({ x: from.x, y: from.y + 0.8, z: from.z }, { x: dx, y: dy, z: dz }, distance);
    return hit === null || hit.distance >= distance - 0.25;
  }

  private killMob(mob: MobRuntime): void {
    const definition = MOB_DEFINITIONS[mob.kind];
    const drop = mob.kind === 'grazer' ? createStack(this.itemRegistry, ItemIds.APPLE, 1) : createStack(this.itemRegistry, ItemIds.STONE, 1);
    this.spawnItemDrop(drop, mob.position.x, mob.position.y + definition.height * 0.45, mob.position.z, { x: 0, y: 3.1, z: 0 });
    this.removeMob(mob);
  }

  private removeMob(mob: MobRuntime): void {
    this.root.remove(mob.root);
    mob.material.dispose();
    this.mobs.delete(mob.id);
  }


  private nearExistingMob(x: number, y: number, z: number, radius: number): boolean {
    const radiusSq = radius * radius;
    for (const mob of this.mobs.values()) if (distanceSquared(mob.position, { x, y, z }) < radiusSq) return true;
    return false;
  }
}
