import type { Vec3Like } from './EntityTypes.ts';

export type ProjectileOwner = 'player' | 'hostile';

export interface ProjectileState {
  readonly id: number;
  readonly owner: ProjectileOwner;
  readonly damage: number;
  readonly position: { x: number; y: number; z: number };
  readonly velocity: { x: number; y: number; z: number };
  ttl: number;
}

export interface MobProjectileHit { readonly mobId: number; readonly t: number; }

export interface ProjectileHooks {
  readonly worldHitT: (start: Vec3Like, end: Vec3Like) => number | null;
  readonly playerHitT: (start: Vec3Like, end: Vec3Like, projectile: ProjectileState) => number | null;
  readonly mobHit?: (start: Vec3Like, end: Vec3Like, projectile: ProjectileState) => MobProjectileHit | null;
}

export type ProjectileEvent =
  | { readonly type: 'player-hit'; readonly projectileId: number; readonly damage: number }
  | { readonly type: 'mob-hit'; readonly projectileId: number; readonly mobId: number; readonly damage: number }
  | { readonly type: 'blocked'; readonly projectileId: number }
  | { readonly type: 'expired'; readonly projectileId: number };

export class ProjectileSystem {
  private readonly projectiles = new Map<number, ProjectileState>();
  private nextId = 1;

  spawn(owner: ProjectileOwner, origin: Vec3Like, velocity: Vec3Like, damage: number, ttl = 4): number {
    if (![origin.x, origin.y, origin.z, velocity.x, velocity.y, velocity.z, damage, ttl].every(Number.isFinite) || damage <= 0 || ttl <= 0) throw new RangeError('Invalid projectile parameters.');
    const id = this.nextId++;
    this.projectiles.set(id, { id, owner, damage, position: { x: origin.x, y: origin.y, z: origin.z }, velocity: { x: velocity.x, y: velocity.y, z: velocity.z }, ttl });
    return id;
  }

  update(dt: number, hooks: ProjectileHooks): ProjectileEvent[] {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Projectile delta must be finite and non-negative.');
    const events: ProjectileEvent[] = [];
    for (const projectile of [...this.projectiles.values()]) {
      const start = { ...projectile.position };
      const end = { x: start.x + projectile.velocity.x * dt, y: start.y + projectile.velocity.y * dt, z: start.z + projectile.velocity.z * dt };
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) {
        this.projectiles.delete(projectile.id);
        events.push({ type: 'expired', projectileId: projectile.id });
        continue;
      }

      const worldT = sanitizeT(hooks.worldHitT(start, end));
      const playerT = projectile.owner === 'hostile' ? sanitizeT(hooks.playerHitT(start, end, projectile)) : null;
      const mobHit = projectile.owner === 'player' && hooks.mobHit ? hooks.mobHit(start, end, projectile) : null;
      const mobT = mobHit ? sanitizeT(mobHit.t) : null;
      const nearest = minimumCollision(worldT, playerT, mobT);
      if (nearest === 'player') {
        this.projectiles.delete(projectile.id);
        events.push({ type: 'player-hit', projectileId: projectile.id, damage: projectile.damage });
        continue;
      }
      if (nearest === 'mob' && mobHit) {
        this.projectiles.delete(projectile.id);
        events.push({ type: 'mob-hit', projectileId: projectile.id, mobId: mobHit.mobId, damage: projectile.damage });
        continue;
      }
      if (nearest === 'world') {
        this.projectiles.delete(projectile.id);
        events.push({ type: 'blocked', projectileId: projectile.id });
        continue;
      }

      projectile.position.x = end.x;
      projectile.position.y = end.y;
      projectile.position.z = end.z;
      projectile.velocity.y -= 1.5 * dt;
    }
    return events;
  }

  get(id: number): ProjectileState | null { return this.projectiles.get(id) ?? null; }
  values(): readonly ProjectileState[] { return [...this.projectiles.values()]; }
  clear(): void { this.projectiles.clear(); }
  get size(): number { return this.projectiles.size; }
}

function sanitizeT(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

function minimumCollision(worldT: number | null, playerT: number | null, mobT: number | null): 'world' | 'player' | 'mob' | null {
  let kind: 'world' | 'player' | 'mob' | null = null;
  let best = Number.POSITIVE_INFINITY;
  if (worldT !== null && worldT < best) { best = worldT; kind = 'world'; }
  if (playerT !== null && playerT < best) { best = playerT; kind = 'player'; }
  if (mobT !== null && mobT < best) { best = mobT; kind = 'mob'; }
  return kind;
}
