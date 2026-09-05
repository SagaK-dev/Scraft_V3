import * as THREE from 'three';
import type { AABB } from '../player/aabb.ts';
import type { VoxelWorld } from '../world/VoxelWorld.ts';
import { segmentAABBIntersectionT } from './EntityMath.ts';
import { ProjectileSystem } from './ProjectileSystem.ts';
import type { Vec3Like } from './EntityTypes.ts';

const PROJECTILE_SPEED = 8.5;

export class ProjectileRuntime {
  private readonly system = new ProjectileSystem();
  private readonly meshes = new Map<number, THREE.Mesh>();
  private readonly geometry = new THREE.SphereGeometry(0.11, 8, 6);
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xf2a23b });

  constructor(private readonly root: THREE.Group, private readonly world: VoxelWorld) {}

  fireHostile(origin: Vec3Like, target: Vec3Like, damage = 2.5): number {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dz = target.z - origin.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    const id = this.system.spawn('hostile', origin, {
      x: dx / length * PROJECTILE_SPEED,
      y: dy / length * PROJECTILE_SPEED,
      z: dz / length * PROJECTILE_SPEED,
    }, damage, 4);
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.name = `projectile-${id}`;
    mesh.position.set(origin.x, origin.y, origin.z);
    this.meshes.set(id, mesh);
    this.root.add(mesh);
    return id;
  }

  update(dt: number, playerBounds: AABB, onPlayerDamage: (damage: number, source: Vec3Like) => void): void {
    const starts = new Map<number, Vec3Like>();
    for (const projectile of this.system.values()) starts.set(projectile.id, { ...projectile.position });
    const events = this.system.update(dt, {
      worldHitT: (start, end) => worldSegmentHitT(this.world, start, end),
      playerHitT: (start, end) => segmentAABBIntersectionT(start, end, playerBounds),
    });
    for (const event of events) {
      if (event.type === 'player-hit') onPlayerDamage(event.damage, starts.get(event.projectileId) ?? { x: 0, y: 0, z: 0 });
    }
    for (const [id, mesh] of [...this.meshes]) {
      const state = this.system.get(id);
      if (!state) {
        this.root.remove(mesh);
        this.meshes.delete(id);
      } else mesh.position.set(state.position.x, state.position.y, state.position.z);
    }
  }

  get size(): number { return this.system.size; }

  dispose(): void {
    for (const mesh of this.meshes.values()) this.root.remove(mesh);
    this.meshes.clear();
    this.system.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}

function worldSegmentHitT(world: VoxelWorld, start: Vec3Like, end: Vec3Like): number | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < 1e-9) return null;
  const hit = world.raycast(start, { x: dx, y: dy, z: dz }, distance);
  return hit ? Math.max(0, Math.min(1, hit.distance / distance)) : null;
}
