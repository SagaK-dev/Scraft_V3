# Architecture

## 目的

長時間遊べるブラウザ向け3Dボクセル・サバイバルゲームを段階的に実装できる構造にする。Gameは各サブシステムを協調させるオーケストレータに留め、Voxel/Player/Inventory/Survival/Containerの状態と規則はそれぞれ独立モジュールへ分離する。

## 技術基盤

- TypeScript / Vite
- Three.js / WebGL2
- requestAnimationFrame rendering + fixed 60 Hz simulation
- Chunk単位BufferGeometry
- IndexedDB永続化はPhase 9
- Worker/Greedy Meshing等の重い最適化はPhase 10

## Core

- `Game`: subsystem orchestration、入力から各simulation/UIへの接続
- `Renderer`: Scene / Camera / WebGLRenderer、day/night lighting、fog、sky
- `InputManager`: keyboard / mouse / Pointer Lock
- `FixedStep`: 60 Hz固定更新とspiral-of-death対策
- `HUD`: settings、F3、HP/Hunger/clock表示

## World / Voxel

- `BlockRegistry`: stable numeric Block IDとblock属性
- `Chunk`: 16 x 256 x 16、`Uint16Array`
- `ChunkManager`: world block access、dirty chunk tracking
- `ChunkMesher`: hidden-face cullingとneighbor-aware mesh data
- `VoxelWorld`: streaming、raycast、break/place、mesh lifetime
- `WorldGenerator`: Seeded Noiseから決定的Chunk生成
- `ChunkStreamer`: Render Distance、nearest-first async queue、load/unload
- `WorldEditStore`: seed生成後のsession-local block差分

負数座標はfloor division + positive moduloで処理し、JavaScriptの`%`をローカル座標へ直接使わない。

## Player Physics

`PlayerController`は入力とcamera stateを管理し、`VoxelPhysics`がThree.js非依存のAABB collisionを処理する。

- standing/crouched AABB
- floor / ceiling / wall
- gravity / jump / fall
- swept axis collisionによるanti-tunneling
- one-block auto-step
- crouch edge safety
- landing fall-distance event

## Items / Crafting

- `ItemRegistry`: Item ID、stack limit、block mapping、tool、food
- `Inventory`: stack merge/swap/insert/removeの汎用container
- `PlayerInventory`: Hotbar 9 + Main 27
- `InventoryUI`: cursor、left/right click、Shift transfer、drag/drop
- `CraftingRegistry`: shaped 2x2/3x3 recipe
- `CraftingService`: output capacityを先に検証してからingredientを消費

## Survival（Phase 6）

`SurvivalState`はHP/Hunger/Saturation/Exhaustionを純粋ロジックとして保持する。

- HP 20 / Hunger 20
- hunger 18以上のnatural regeneration
- hunger 0のstarvation damage
- movement exhaustion
- landing distanceからfall damageを一度だけ適用
- HP 0でgenerated surfaceへrespawn

`DayNightCycle`は1200秒を1日としてnormalized timeを進め、Rendererへdaylightを渡す。normalized 0.0は00:00、0.5は12:00とする。

## Combat（Phase 6/7）

`MeleeCombat`はattack cooldownとheld-item damageをThree.js非依存で計算する。Phase 6の`CombatTargetManager`は戦闘統合を実際に操作確認するためのTraining Targetのみを提供する。Entity/Mob AI、spawn/pathfindingはPhase 7で置き換え・拡張する。

## Audio（Phase 6）

`GameAudio`はWeb Audio APIで短いオリジナル効果音を合成する。外部ゲームの音源assetは利用しない。AudioContextはユーザー操作後にunlockし、dispose時にcloseする。

## Furnace / Chest（Phase 6）

- `BlockEntityStore`: world XYZをkeyにChest/Furnace stateを所有
- `FurnaceState`: input/fuel/output、burn time、cook progress
- `FurnaceRecipes`: smelting/fuel table
- `ContainerUI`: Chest/FurnaceとPlayer Inventoryのtransfer UI
- `ContainerTransfer`: block破壊時のtransactional回収

Block EntityはChunkのMesh/data lifecycleから分離するため、Chunkがstream-outしても同一ページsession中は内容を保持できる。Chest/Furnaceを壊す際は内容物とContainer block本体の全量がPlayer Inventoryへ入るか一時Inventoryでpreflightし、容量不足ならworld blockを変更しない。

## Save（Phase 9予定）

IndexedDBへworld metadata/seed/schema、player state、survival、inventory、game time、block edits、Chest/Furnace stateをtransaction単位で保存する。Phase 6時点のBlock Entity/Survival/Timeはsession-local。

## Memory / Performance

- 1 block = 1 Meshは禁止
- Chunk geometry交換時に旧BufferGeometryをdispose
- shared material/textureはChunkごとに破棄しない
- stream-out済みChunkのMeshをScene/Mapから除去
- Phase 10でWorker terrain/meshing、Greedy Meshing、queue priority、cache/pooling、long-run memory profilingを追加

## Debug

F3にFPS、XYZ、Chunk、Seed、Render Distance、loaded/pending chunks、runtime edits、block entities、grounded/crouched/fall distance、HP/Hunger/Saturation、day/time/daylight、Hotbar、triangles/draw calls/GPU resource数を表示する。
