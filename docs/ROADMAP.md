# Development Roadmap

## Phase 1 — Game foundation ✅
Three.js / WebGL2、FPS camera、InputManager、fixed timestep、HUD/settings、CI/tests。

## Phase 2 — Voxels ✅
Block/Chunk/Uint16Array、visible-face mesh、neighbor culling、raycast、break/place、remesh。

## Phase 3 — World generation ✅
Seeded Noise、決定的terrain、Render Distance、player-follow load/unload、async queue。

## Phase 4 — Player physics ✅
Voxel AABB、gravity/jump/crouch/sprint、step、edge safety、swept anti-tunneling、fall tracking。

## Phase 5 — Items / Inventory / Crafting ✅
ItemRegistry、Hotbar/Main inventory、stack操作、2x2/3x3 Crafting、tools、durability、Crafting Table。

## Phase 6 — Survival ✅
HP、Hunger/Saturation、自然回復、飢餓、落下ダメージ、近接戦闘基盤、Day/Night、Web Audio、Furnace、Chest、block entity state。

## Phase 7 — Entities / Mobs ✅
EntityManager、Item Drop/Pickup、Passive Grazer、Hostile Stalker、決定的spawn rules、Mob AI、追跡/近接・遠距離攻撃、knockback、Projectile continuous collision、bounded A* pathfindingを実装済み。

## Phase 8 — Advanced world
Biome、caves、ore veins、trees/plants、sun/block light、water、weather/structure extension points。

## Phase 9 — Persistence
IndexedDB world list、seed+delta save、player/survival/inventory/chest/furnace/time/entity save、schema migration、transaction safety。

## Phase 10 — Optimization
Worker terrain/meshing、Greedy Meshing、frustum/distance priority、entity LOD/tick throttling、code splitting、cache/pooling、memory profiling、long-run tests。

## Completion rule for every phase
Implement -> review -> bug check -> typecheck -> automated tests -> build -> performance/memory review -> fix -> rerun checks.
