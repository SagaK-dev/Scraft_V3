# Scraft V3 Architecture

## 目的

長時間遊べるブラウザ向け3Dボクセル・サバイバルゲームを、段階的に実装できる構造にする。Phase 1で実行基盤、Phase 2でBlock/Chunk/Mesh/Raycast/Interactionを追加した。World/Chunk/Block/Entityの詳細はGameへ直書きせず、各サブシステムへ分離する。

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
- `PlayerController`: 移動・視点と設置判定用AABB。Phase 4でWorld collisionへ拡張
- `HUD`: DOM UI、設定、F3表示、ブロック選択/破壊進行表示
- `VoxelWorld`: ChunkManager / mesh / raycast / break / placeの高水準アクセスポイント
- `ChunkManager`: Chunkの所有、world block access、dirty chunk tracking
- `ChunkMesher`: Three.js非依存のmesh data生成
- `BlockBreaker`: 長押し破壊進行の純粋ロジック

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

## チャンク設計（Phase 2実装 / Phase 3拡張）

標準チャンクは X=16, Z=16, Y=256。内部ボクセルは`Uint16Array(16*256*16)`を基本とする。Block IDは0をAIRとし、BlockRegistryから属性を引く。

インデックス案:

`index = x + z * 16 + y * 16 * 16`

- world -> chunk: `Math.floor(block / 16)`
- world -> local: positive modulo
- 負数座標は `%` を直接利用しない
- Phase 2のChunk keyは `"x,z"` 文字列。Phase 3の大量ストリーミング時にpacked keyとの計測比較を行う

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

## ワールド生成（Phase 3/8）

Seedから決定的に生成する。2D/3D NoiseとFBM/Domain Warpingを組み合わせるが、Noise実装はseed決定性のテストを持つ。

地形、biome、cave、ore、vegetationを別ステージにし、後からWorkerへ移動できる純粋データ処理に寄せる。

## Entity

Phase 5〜7で導入。

- Entity: id, transform, velocity, AABB, lifecycle
- ItemEntity
- Mob base
- PassiveMob / HostileMob
- Projectile

描画オブジェクトとsimulation stateを分離し、遠距離entityは低頻度tick/休止できるようにする。

## Player Physics

Phase 4でプレイヤーAABBを導入。各fixed stepを必要に応じてsubstep化し、X/Y/Zのswept collisionまたはaxis-separated resolutionで高速時の壁抜けを抑える。

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

UIはゲーム描画から分離。Phase 5以降Hotbar/Inventoryを追加。AudioManagerはPhase 6までに導入し、master/music/sfx busを持つ。

## メモリ方針

- Chunk unloadでBufferGeometry.dispose
- chunk固有materialを作らず共有
- event listenerはdisposeで解除
- Worker jobにはgeneration idを付け、unload済みchunkへの古い結果を破棄
- Item/MobはpoolingをPhase 10で計測後に導入

## Debug

F3にFPS、XYZ、chunk、biome、seed、loaded chunks、triangles、draw calls、GPU resource数を段階的に追加する。
