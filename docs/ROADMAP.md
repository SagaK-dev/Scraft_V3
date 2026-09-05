# Development Roadmap

## Phase 1 — Game foundation

Three.js / WebGL2、FPS camera、InputManager、fixed timestep、PlayerController、HUD/settings、debug overlay、CI/tests。

## Phase 2 — Voxels ✅

Block/BlockRegistry、Chunk/ChunkManager、Uint16Array voxel storage、visible-face meshing、chunk-border neighbor lookup、voxel raycast、selection outline、hold-to-break、right-click placement、player-overlap prevention、neighbor remeshを実装済み。

## Phase 3 — World generation ✅

Seeded Value Noise / fBM / Ridged Noise / Domain Warp、決定的terrain生成、player-follow load/unload、Render Distance、nearest-first非同期生成キュー、runtime edit再適用を実装済み。

## Phase 4 — Player physics

Voxel AABB collision、gravity、jump、sprint/crouch、step handling、water motion、fall tracking、anti-tunneling。

## Phase 5 — Items / Inventory / Crafting

ItemRegistry、9-slot hotbar、inventory stacks、drag/drop、split、shift-click、2x2/3x3 recipes、tools、durability、crafting table。

## Phase 6 — Survival

HP、hunger、regeneration、fall damage、combat、day/night、AudioManager、basic furnace/chest interactions。

## Phase 7 — Entities / Mobs

Entity manager、item drops/pickup、passive/hostile mobs、spawn rules、melee/ranged combat、simple pathfinding。

## Phase 8 — Advanced world

Biome、caves、ore veins、trees/plants、sun/block light、water、weather/structure extension points。

## Phase 9 — Persistence

IndexedDB world list、seed+delta save、player/inventory/chest/time save、load/delete、schema migration、transaction safety。

## Phase 10 — Optimization

Worker terrain/meshing、Greedy Meshing、frustum/distance priority、cache/pooling、memory profiling、long-run tests、render-distance 8 baseline and 16–24 tuning.

## Completion rule for every phase

Implement -> review -> bug check -> typecheck -> automated tests -> build -> performance/memory review -> fix -> rerun checks.
