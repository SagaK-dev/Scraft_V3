# Phase 7 Review

## Scope

Phase 7 replaces the Phase 6 static Training Target with a real entity lifecycle and connects world drops, pickup, passive/hostile AI, attacks, knockback, projectiles and bounded pathfinding to the existing voxel/survival systems.

## Implemented

- `EntityManager` orchestrates mobs while `ItemDropManager` and `ProjectileRuntime` own drop/projectile runtime lifecycles
- Item Drop gravity, voxel collision, bounce/drag, 0.35s pickup delay, 300s lifetime
- partial pickup: Inventory remainder stays in the same world entity
- nearby compatible Item Drop merging without exceeding item stack limits
- block / Chest / Furnace / mob drops use Item Drop Entity rather than direct inventory insertion
- Chest/Furnace contents are extracted only after successful block break and then emitted as drops
- Passive `Grazer`: deterministic wandering, bounded pathfinding and flee response after damage
- Hostile `Stalker`: detection, path chase, melee, ranged projectile and cooldowns
- deterministic day/night spawn planning from world seed + spawn cycle
- passive/hostile population caps, spawn annulus and distance despawn
- mob voxel AABB movement with gravity and one-block step
- bounded four-neighbor A* with vertical stand-height sampling
- mob and player knockback
- projectile continuous segment collision and nearest-hit resolution
- F3 entity/mob/drop/projectile diagnostics

## Review findings and fixes

- Ground drops originally checked distance from the Player eye position, which made low drops hard to collect. Pickup now measures distance to the Player AABB.
- Projectile collision originally depended on collision-hook order. The system now compares normalized segment hit fractions and chooses the nearest wall/player/mob collision.
- Hostile AI could fall back to passive wandering while engaged but waiting for an attack cooldown. Engaged Stalkers now hold/chase according to hostile state instead.
- Stalker melee originally depended mainly on horizontal range. Melee now also requires Line of Sight and at most a two-block vertical difference, preventing attacks through walls or large height gaps.
- Hostile ranged shots are limited by range, vertical difference, cooldown and Line of Sight.
- Item Drop pickup is transactional at stack level: only the amount actually inserted is removed; a full Inventory leaves the world drop intact.
- Container block destruction no longer depends on free Player Inventory capacity. Contents and the container block become ground entities, preventing full-inventory item loss.
- Mob and projectile motion use bounded/continuous collision paths rather than destination-only checks where tunneling would be most visible.
- Per-mob path searches cap expanded nodes/path length to avoid one AI request monopolizing a frame.

## Automated verification

Phase 7 adds tests for deterministic spawn planning, day/night mob classes, population caps, despawn distance, obstacle/height-aware pathfinding, item pickup timing/lifetime, continuous segment-AABB hits, projectile nearest-collision ordering, hostile chase/melee/ranged rules, wall/vertical melee restrictions, and Block Entity extraction.

CI additionally runs strict TypeScript checking, the complete regression test suite, Vite production build and `npm audit --audit-level=high`.

## Known limitations

- Grazer/Stalker currently use simple original box geometry and have no skeletal animation.
- Pathfinding is a bounded local X/Z A* rather than a navmesh; complex caves and multi-level routes will need Phase 8/10 refinement.
- Projectile infrastructure supports owners generically, but the current playable ranged projectile source is the hostile Stalker; a Player bow/weapon is not yet part of the item set.
- Spawn ecology is based on daylight and terrain validity only; biome-specific spawn tables arrive with Phase 8 biomes.
- Entities and ground drops are session-local until Phase 9 persistence.
- Distant entity tick throttling/LOD and stronger pooling are Phase 10 optimization work.
- Actual browser/GPU long-run FPS and interaction feel still require manual browser validation.
