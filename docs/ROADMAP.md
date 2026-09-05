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
HP、Hunger/Saturation、自然回復、飢餓、落下ダメージ、近接戦闘基盤、Training Target、Day/Night、Web Audio効果音、Furnace、Chest、block entity container stateを実装済み。

## Phase 7 — Entities / Mobs
Entity manager、item drops/pickup、passive/hostile mobs、spawn rules、Mob AI、combat integration、simple pathfinding。

## Phase 8 — Advanced world
Biome、caves、ore veins、trees/plants、sun/block light、water、weather/structure extension points。

## Phase 9 — Persistence
IndexedDB world list、seed+delta save、player/survival/inventory/chest/furnace/time save、schema migration、transaction safety。

## Phase 10 — Optimization
Worker terrain/meshing、Greedy Meshing、frustum/distance priority、cache/pooling、memory profiling、long-run tests。

## Completion rule for every phase
Implement -> review -> bug check -> typecheck -> automated tests -> build -> performance/memory review -> fix -> rerun checks.
