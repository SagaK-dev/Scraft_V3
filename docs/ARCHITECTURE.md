# Scraft V3 Architecture

## 目的

長時間遊べるブラウザ向け3Dボクセル・サバイバルゲームを、段階的に実装できる構造にする。Phase 1で実行基盤、Phase 2でBlock/Chunk/Mesh/Raycast/Interaction、Phase 3でSeeded terrainとchunk streaming、Phase 4でVoxel AABB player physics、Phase 5でItems / Inventory / Craftingを追加した。World/Chunk/Block/Entityの詳細はGameへ直書きせず、各サブシステムへ分離する。

## 技術基盤

- TypeScript strict mode
- Three.js / WebGL2
- Vite
- IndexedDB（Phase 9）
- Web Worker（Phase 10。Phase 3から境界を意識して設計）
- SharedArrayBuffer / WebAssemblyは計測結果が必要になった場合のみ導入

## ランタイム構造

`Game` はライフサイクルとサブシステムの接続だけを担当する。

- `Renderer`: Scene / Camera / WebGLRenderer、画面サイズ、GPUリソース解放
- `InputManager`: keyboard / mouse / pointer lock
- `FixedStep`: 60Hz固定更新とspiral-of-death対策
- `PlayerController`: 入力から速度/stanceを計算し、VoxelPhysicsの結果をplayer/camera stateへ反映
- `HUD`: DOM UI、設定、F3表示、ブロック選択/破壊進行表示
- `VoxelWorld`: ChunkManager / mesh / raycast / break / placeの高水準アクセスポイント
- `ChunkManager`: Chunkの所有、world block access、dirty chunk tracking
- `ChunkMesher`: Three.js非依存のmesh data生成
- `BlockBreaker`: 長押し破壊進行の純粋ロジック
- `WorldGenerator`: Seeded NoiseからChunkを決定的に生成
- `ChunkStreamer`: player chunk / Render Distanceに基づくload/unloadとnearest-first非同期生成
- `WorldEditStore`: アンロードされたchunkへセッション内編集差分を再適用
- `VoxelPhysics`: Three.js非依存のswept AABB、step、support/ceiling/wall判定、anti-tunneling
- `ItemRegistry`: item ID、stack上限、block placement mapping、tool定義
- `PlayerInventory`: Hotbar 9 + Main 27、selected slot、insert/consume/shift-click/durability
- `CraftingGrid` / `CraftingRegistry`: 2x2/3x3 shaped recipe matching
- `InventoryUI`: Hotbar表示、cursor操作、drag/drop、right-click split、Crafting UI

## ゲームループ

描画は`requestAnimationFrame`。物理は1/60秒固定ステップ。

1. 実フレームdeltaを0.1秒以下にクランプ
2. Mouse deltaを取り込む
3. FixedStepで0〜5回のsimulation update
4. previous/current positionを補間
5. cameraを更新
6. render
7. 0.5秒ごとにdebug stats更新

タブ非表示やpointer lock解除時は入力とaccumulatorをリセットし、復帰直後の大deltaを持ち越さない。

## チャンク設計（Phase 3実装）

標準チャンクは X=16, Z=16, Y=256。内部ボクセルは`Uint16Array(16*256*16)`を基本とする。Block IDは0をAIRとし、BlockRegistryから属性を引く。

インデックス案:

`index = x + z * 16 + y * 16 * 16`

- world -> chunk: `Math.floor(block / 16)`
- world -> local: positive modulo
- 負数座標は `%` を直接利用しない
- Chunk keyは `"x,z"` 文字列。Phase 10のprofilingでpacked integer/BigIntへの変更価値を計測する

## Blockデータ

BlockRegistryに以下を保持する。

- numeric ID
- stable string key
- opaque / transparent / solid
- hardness
- preferred tool category
- texture atlas face indices
- light emission
- collision shape
- drop table key

頻繁に参照するチャンク内データはobject配列ではなくTypedArrayで保持する。

## Mesh

1ブロック=1Meshは禁止。チャンク単位の`BufferGeometry`を生成する。

Phase 2実装:
- 6面のneighbor確認
- 空気/非opaque境界だけface生成
- 同一透明Blockの内部面も除去
- chunk edgeでは隣接chunkを照会
- geometry rebuild時に旧geometryをdispose
- mesh data生成はThree.js非依存

今後:
- opaque / transparentを別drawに分離
- Texture Atlas

Phase 10:
- Greedy Meshing
- Worker mesh generation
- rebuild queue / priority
- chunk cache / pooling

Texture Atlasは共有Texture 1枚を基本とし、チャンクアンロード時に共有Textureをdisposeしない。

## ワールド生成（Phase 3実装 / Phase 8拡張）

Phase 3では文字列SeedをFNV-1a系32bit hashへ変換し、Seeded Value Noise、fBM、Ridged fBM、Domain Warpを組み合わせて地形高を決定する。同じSeed・同じworld座標では生成順序に依存せず同じ結果になる。

`WorldGenerator`はThree.jsへ依存せず`Chunk`だけを返す純粋データ境界に寄せる。`ChunkStreamer`は現在位置のchunkとRender Distanceからtargetを作り、中心から近い順に1chunkずつevent loopへyieldしながら生成する。load/unload時は隣接meshをdirty化し、unload paddingで境界往復時のthrashを抑える。

Phase 8でbiome、3D cave noise、ore、vegetation、水、lightingを別stageとして追加する。Phase 10ではterrain/meshingをWeb Workerへ移動する。

## Entity

Phase 5〜7で導入。

- Entity: id, transform, velocity, AABB, lifecycle
- ItemEntity
- Mob base
- PassiveMob / HostileMob
- Projectile

描画オブジェクトとsimulation stateを分離し、遠距離entityは低頻度tick/休止できるようにする。

## Player Physics（Phase 4実装）

プレイヤーは立位0.6 x 1.8 x 0.6、しゃがみ0.6 x 1.5 x 0.6のAABBを使う。`VoxelPhysics`はThree.jsへ依存せず、各axisの移動経路全体をbroadphase走査して最初のsolid voxel faceまで移動量をclampする。destination-only collisionではないため、固定tick中に1ブロック以上進む異常速度でも薄い壁を飛び越えにくい。

- Y sweep: floor / ceiling / grounded
- X/Z sweep: wall / sliding
- grounded + standing: 最大1 voxelのauto-step
- crouch + grounded: supportを失う水平移動をbinary clamp
- uncrouch: standing AABBが空いている場合のみ許可
- fall distance: landingまで累積しPhase 6 damageへ渡せる状態を保持

`VoxelWorld`は現在player chunkの周囲3x3をphysics safety neighborhoodとして同期確保する。これによりPhase 3の遠距離async streamingを維持しつつ、未ロードchunk境界をair扱いして奈落へ落ちることを防ぐ。

## Items / Inventory / Crafting（Phase 5実装）

ItemとBlockはnumeric IDを別namespaceで管理し、Block itemは`ItemRegistry`の`placeBlockId`から対応付ける。Inventoryは36 slot固定で、0〜8をHotbar、9〜35をMainとして扱う。

`ItemStack`は`itemId / count / damage`だけを保持する。通常itemは最大64、toolは最大1。tool durabilityはdamageとして増加し、maxDurability到達時にstackを削除する。

CraftingはDOMから分離した純粋ロジックで、recipeは`width / height / pattern / output / mirror`を持つ。2x2 Player CraftingではPlanks / Stick / Crafting Table、Crafting Tableを右クリックした3x3ではWooden/Stone tool recipesを利用できる。出力がInventoryへ完全に入らない場合はinputを消費しない。

UI操作:
- left click: cursorへstack全体を持つ / merge / swap
- right click: 半分pickup / cursorから1個place
- HTML drag/drop: slot間stack move / merge / swap
- Shift+click: Hotbar <-> Main、Craft input -> Inventory
- Shift+Craft output: 入力または空きが尽きるまで連続craft

Crafting UIを閉じる時はcursorとgrid inputをInventoryへ戻す。入り切らない場合は閉じる処理を拒否し、item lossを防ぐ。

Block破壊後は対応するblock itemをInventoryへinsertする。選択toolがBlockの`preferredTool`と一致する場合だけ採掘速度を適用し、破壊成功時にdurabilityを1消費する。選択中itemに`placeBlockId`がある場合、右クリック設置成功後にstackを1消費する。

## Save

IndexedDBに複数worldを保存する。

保存対象:
- world metadata / seed / schema version
- player state
- inventory
- game time
- chest/block entity data
- seed生成後との差分block edits

生成済みチャンク全体を無条件保存しない。schema versionとmigrationを設け、書き込みはtransaction単位で行う。

## UI/Audio

UIはゲーム描画から分離。Phase 5でHotbar/Inventory/CraftingをDOM UIとして実装。AudioManagerはPhase 6までに導入し、master/music/sfx busを持つ。

## メモリ方針

- Chunk unloadでBufferGeometry.dispose
- chunk固有materialを作らず共有
- event listenerはdisposeで解除
- Phase 3 queueはdesired targetを毎回検証してstale生成を破棄
- Phase 10 Worker jobにはgeneration idを付け、unload済みchunkへの古い結果を破棄
- Item/MobはpoolingをPhase 10で計測後に導入

## Debug

F3にFPS、XYZ、chunk、seed、Render Distance、loaded/pending chunks、runtime edits、grounded/crouched/fall distance、selected Hotbar item、triangles、draw calls、GPU resource数を表示する。BiomeはPhase 8で追加する。
