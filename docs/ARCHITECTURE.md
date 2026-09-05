# Architecture

## 目的

長時間遊べるブラウザ向け3Dボクセル・サバイバルゲームを段階的に実装できる構造にする。`Game`は各サブシステムを協調させるオーケストレータに留め、Voxel / Player / Inventory / Survival / Container / Entityの状態と規則を分離する。

## 技術基盤

- TypeScript / Vite
- Three.js / WebGL2
- requestAnimationFrame rendering + fixed 60 Hz simulation
- Chunk単位BufferGeometry
- IndexedDB永続化はPhase 9
- Worker / Greedy Meshing / entity LOD等の重い最適化はPhase 10

## Core

- `Game`: subsystem orchestration、入力・simulation・UIの接続
- `Renderer`: Scene / Camera / WebGLRenderer、day/night lighting、fog、sky
- `InputManager`: keyboard / mouse / Pointer Lock
- `FixedStep`: 60 Hz固定更新とspiral-of-death対策
- `HUD`: settings、F3、HP/Hunger/clock表示

## World / Voxel

- `BlockRegistry`: stable numeric Block IDとblock属性
- `Chunk`: 16 x 256 x 16、`Uint16Array`
- `ChunkManager`: world block access、dirty chunk tracking
- `ChunkMesher`: hidden-face cullingとneighbor-aware mesh data
- `VoxelWorld`: streaming、raycast、break/place、mesh lifetime、entity collision source
- `WorldGenerator`: Seeded Noiseから決定的Chunk生成
- `ChunkStreamer`: Render Distance、nearest-first async queue、load/unload
- `WorldEditStore`: seed生成後のsession-local block差分

負数座標はfloor division + positive moduloで処理し、JavaScriptの`%`をローカル座標へ直接使わない。

## Player Physics

`PlayerController`は入力とcamera stateを管理し、`VoxelPhysics`がThree.js非依存のAABB collisionを処理する。Phase 7では`applyImpulse`を介してMob/Projectile knockbackも同じvelocity stateへ加える。

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

## Survival

`SurvivalState`はHP/Hunger/Saturation/Exhaustionを純粋ロジックとして保持する。`DayNightCycle`は1200秒を1日としてnormalized timeを進め、RendererとPhase 7 spawn rulesのdaylight入力へ渡す。

## Combat

- `MeleeCombat`: Playerのattack cooldownとheld-item melee damage
- `EntityManager.damageMob`: Mob HP、被弾flash、knockback、death/drop
- Player damageはEntity hookから`SurvivalState`へ渡し、PlayerControllerへknockback impulseを適用
- Mob raycastとVoxel raycastを距離比較し、手前の対象だけを攻撃する

Phase 6の`CombatTargetManager`はPhase 7ではruntimeから外れ、実Mobへ置き換えられた。

## Entities / Mobs（Phase 7）

`EntityManager`はMob lifecycleとPhase 7 entity subsystemのオーケストレーションを担い、ground itemは`ItemDropManager`、projectile描画/runtimeは`ProjectileRuntime`へ分離する。AIの決定・pathfinding・spawn planning・projectile collision coreはThree.js非依存モジュールに分離する。

### Item Drop

- `ItemDropState`: pickup delay / lifetime
- `ItemDropManager`: voxel gravity/collision、bounce/drag、rotation、stack merge、Player AABB proximity pickup
- `Inventory.insert`のremainderをそのままEntityへ戻すため、満杯時もitemを失わない
- Block/Chest/Furnace/Mobのdrop経路をworld entityへ統一

### Mob

初期mobは独自の2種類。

- `Grazer`: passive、wander、被弾時flee
- `Stalker`: hostile、Player検知、chase、melee、ranged projectile

Mob移動は`VoxelPhysics.moveAABB`を再利用してgravity / collision / one-block stepを処理する。個体数はpassive/hostile capを持ち、Playerから52 blocksを超える個体はdespawn可能。

### Spawn Rules

`SpawnRules`はworld seed、spawn cycle、Player XZ、daylight、現在個体数から候補を決定的に作る。通常spawnはPlayerから14〜28 blocksのringを使い、daylight>=0.5はpassive、daylight<=0.25はhostileを優先する。実際のspawn前にworld surface / stand space / 高低差 / 既存Mob距離を再検証する。

### Pathfinding

`SimplePathfinder`は4方向のbounded A*。

- X/Z grid node
- stand-height samplerで1-block程度のheight changeを評価
- vertical movement cost
- expanded node上限
- path length上限
- 完全到達できない場合は探索済みのtarget最寄りnodeまでのpathを返せる

### Projectile

`ProjectileSystem`はowner / position / velocity / damage / TTLを純粋stateとして保持する。1 tickのstart→end segmentでworld/player/mob候補hitのnormalized `t`を比較し、最も近い衝突だけを確定する。これにより高速Projectileのdestination-only tunnelingとhook-order依存を避ける。

`ProjectileRuntime`が`ProjectileSystem`とThree.js mesh lifecycleを接続する。現時点ではStalkerがProjectileを発射する。Player ranged weaponは将来Item/Combat拡張で接続可能。

## Audio

`GameAudio`はWeb Audio APIで短いオリジナル効果音を合成する。外部ゲームの音源assetは利用しない。Phase 7でpickup/mob/projectile用profileも持つ。

## Furnace / Chest

- `BlockEntityStore`: world XYZをkeyにChest/Furnace stateを所有
- `FurnaceState`: input/fuel/output、burn time、cook progress
- `ContainerUI`: Chest/FurnaceとPlayer Inventoryのtransfer UI
- Phase 7の`extractAt`で破壊後の内容をItem Drop Entityへ変換

Block EntityはChunk lifecycleから分離するためstream-out中も同一sessionで保持する。Phase 7ではContainerを破壊できた時点で中身とblock本体をworld dropへ移すため、Player Inventory満杯でもitemを消失しない。

## Save（Phase 9予定）

IndexedDBへworld metadata/seed/schema、player state、survival、inventory、game time、block edits、Chest/Furnace、必要なentity stateをtransaction単位で保存する。Phase 7時点のMob/ground item/projectileはsession-local。

## Memory / Performance

- 1 block = 1 Meshは禁止
- Chunk geometry交換時に旧BufferGeometryをdispose
- Entityはshared Box/Sphere geometryを再利用
- ground item materialはitem ID単位でcache
- Mob population capとdespawn rangeを設ける
- pathfinding node/path上限でAI spikeを抑える
- Phase 10でdistant entity low-frequency tick/LOD、pooling、Worker terrain/meshing、Greedy Meshing、code splitting、long-run profilingを追加

## Debug

F3にFPS、XYZ、Chunk、Seed、Render Distance、loaded/pending chunks、runtime edits、block entities、grounded/crouched/fall distance、HP/Hunger/Saturation、day/time/daylight、Hotbar、Entity/Passive/Hostile/Drop/Projectile数、triangles/draw calls/GPU resource数を表示する。
