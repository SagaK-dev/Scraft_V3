import * as THREE from 'three';
import type { AABB } from '../player/aabb.ts';
import { moveAABB } from '../player/VoxelPhysics.ts';
import type { ItemRegistry } from '../items/ItemRegistry.ts';
import { canStackTogether, cloneStack, type ItemStack } from '../items/ItemStack.ts';
import type { VoxelWorld } from '../world/VoxelWorld.ts';
import { distanceSquared, pointAABBDistanceSquared } from './EntityMath.ts';
import { ItemDropState } from './ItemDropState.ts';
import type { Vec3Like } from './EntityTypes.ts';

const PICKUP_RADIUS_SQ = 1.6 * 1.6;
const MERGE_RADIUS_SQ = 1.2 * 1.2;

interface RuntimeDrop {
  readonly id: number;
  readonly mesh: THREE.Mesh;
  readonly state: ItemDropState;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
}

export interface ItemDropHooks {
  readonly tryPickup: (stack: ItemStack) => ItemStack | null;
  readonly onPickup?: (stack: ItemStack) => void;
}

export class ItemDropManager {
  private readonly drops = new Map<number, RuntimeDrop>();
  private readonly geometry = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  private readonly materials = new Map<number, THREE.MeshLambertMaterial>();
  private nextId = 1;

  constructor(
    private readonly root: THREE.Group,
    private readonly world: VoxelWorld,
    private readonly items: ItemRegistry,
    private readonly seed: number,
  ) {}

  spawn(stack: ItemStack, x: number, y: number, z: number, velocity?: Vec3Like): number {
    this.items.get(stack.itemId);
    if (![x, y, z].every(Number.isFinite)) throw new RangeError('Item drop position must be finite.');
    const incoming = cloneStack(stack);
    for (const drop of this.drops.values()) {
      if (distanceSquared(drop.position, { x, y, z }) > MERGE_RADIUS_SQ) continue;
      if (!canStackTogether(drop.state.stack, incoming, this.items)) continue;
      const limit = this.items.get(incoming.itemId).maxStack;
      const moved = Math.min(incoming.count, limit - drop.state.stack.count);
      if (moved <= 0) continue;
      drop.state.stack.count += moved;
      incoming.count -= moved;
      if (incoming.count === 0) return drop.id;
    }

    const id = this.nextId++;
    const mesh = new THREE.Mesh(this.geometry, this.materialFor(incoming.itemId));
    mesh.name = `item-drop-${id}`;
    mesh.position.set(x, y, z);
    this.root.add(mesh);
    const initial = velocity ?? burstVelocity(this.seed, id);
    this.drops.set(id, {
      id,
      mesh,
      state: new ItemDropState(incoming),
      position: mesh.position,
      velocity: new THREE.Vector3(initial.x, initial.y, initial.z),
    });
    return id;
  }

  spawnMany(stacks: readonly ItemStack[], x: number, y: number, z: number): void {
    for (let index = 0; index < stacks.length; index += 1) {
      const stack = stacks[index];
      if (!stack) continue;
      this.spawn(stack, x, y, z, burstVelocity(this.seed ^ (index + 1), this.nextId));
    }
  }

  update(dt: number, playerBounds: AABB, hooks: ItemDropHooks): void {
    for (const drop of [...this.drops.values()]) {
      drop.state.update(dt);
      if (drop.state.expired) { this.remove(drop); continue; }
      drop.velocity.y = Math.max(-18, drop.velocity.y - 18 * dt);
      const half = 0.13;
      const bounds = {
        minX: drop.position.x - half, minY: drop.position.y - half, minZ: drop.position.z - half,
        maxX: drop.position.x + half, maxY: drop.position.y + half, maxZ: drop.position.z + half,
      };
      const motion = moveAABB(bounds, {
        x: drop.velocity.x * dt, y: drop.velocity.y * dt, z: drop.velocity.z * dt,
      }, this.world, { allowStep: false, stepHeight: 0, keepSupported: false });
      drop.position.set(
        (motion.bounds.minX + motion.bounds.maxX) / 2,
        (motion.bounds.minY + motion.bounds.maxY) / 2,
        (motion.bounds.minZ + motion.bounds.maxZ) / 2,
      );
      if (motion.grounded && drop.velocity.y < 0) drop.velocity.y *= -0.18;
      if (motion.hitX) drop.velocity.x *= -0.2;
      if (motion.hitZ) drop.velocity.z *= -0.2;
      const drag = motion.grounded ? Math.max(0, 1 - 4 * dt) : Math.max(0, 1 - 0.3 * dt);
      drop.velocity.x *= drag;
      drop.velocity.z *= drag;
      drop.mesh.rotation.y += dt * 1.8;
      drop.mesh.rotation.x += dt * 0.8;
      this.tryPickup(drop, playerBounds, hooks);
    }
  }

  get size(): number { return this.drops.size; }

  dispose(): void {
    for (const drop of this.drops.values()) this.root.remove(drop.mesh);
    this.drops.clear();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.geometry.dispose();
  }

  private tryPickup(drop: RuntimeDrop, bounds: AABB, hooks: ItemDropHooks): void {
    if (!drop.state.canPickup || pointAABBDistanceSquared(drop.position, bounds) > PICKUP_RADIUS_SQ) return;
    const before = cloneStack(drop.state.stack);
    const remainder = hooks.tryPickup(before);
    const picked = before.count - (remainder?.count ?? 0);
    if (picked > 0) hooks.onPickup?.({ itemId: before.itemId, count: picked, damage: before.damage });
    if (!remainder) this.remove(drop);
    else {
      drop.state.stack.count = remainder.count;
      drop.state.stack.damage = remainder.damage;
    }
  }

  private remove(drop: RuntimeDrop): void {
    this.root.remove(drop.mesh);
    this.drops.delete(drop.id);
  }

  private materialFor(itemId: number): THREE.MeshLambertMaterial {
    let material = this.materials.get(itemId);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color: this.items.get(itemId).color });
      this.materials.set(itemId, material);
    }
    return material;
  }
}

function burstVelocity(seed: number, id: number): Vec3Like {
  const angle = deterministicUnit(seed, id, 1, 0x6d2b) * Math.PI * 2;
  const speed = 0.7 + deterministicUnit(seed, id, 2, 0x91e1) * 0.8;
  return { x: Math.cos(angle) * speed, y: 2.4 + deterministicUnit(seed, id, 3, 0xb529) * 1.1, z: Math.sin(angle) * speed };
}

function deterministicUnit(seed: number, a: number, b: number, salt: number): number {
  let x = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, salt)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}
