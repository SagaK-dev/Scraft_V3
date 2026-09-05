# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 5: Items / Inventory / Craftingまで実装済みです。

- Phase 1のThree.js / WebGL2 / FPS視点 / 固定60Hz更新 / 設定 / F3 / CI
- Phase 2のBlock / Chunk / Uint16Array / meshing / Raycast / break / place
- Phase 3のSeeded Noise地形 / 決定的生成 / player-follow chunk streaming / Render Distance
- Phase 4のVoxel AABB / gravity / jump / crouch / step / anti-tunneling
- ItemRegistryとBlock item mapping
- Hotbar 9 + Main Inventory 27 = 36 slots
- stack上限、merge、swap、split、Shift transfer
- 1〜9 / マウスホイールでHotbar選択
- EでPlayer Inventory + 2x2 Crafting
- 左クリックcursor操作、HTML drag/drop、右クリック半分/1個、Shift+クリック
- 2x2 / 3x3 shaped recipes
- Wooden Planks / Stick / Crafting Table
- Wooden Pickaxe / Axe / Shovel / Stone Pickaxe
- tool categoryによる採掘速度
- tool durabilityと破損
- Crafting Table blockを設置し、右クリックで3x3 Craftingを開く
- block破壊時に対応itemをInventoryへ回収
- 選択block itemを右クリックで設置してstackを1個消費
- Crafting出力がInventoryへ入らない場合は素材を消費しない
- Crafting UIを閉じる時はgrid/cursor itemをInventoryへ返却

Phase 8で木などのvegetationを自然生成するまでは、Phase 5のCrafting動作確認用として開始時HotbarにWoodを8個だけ仮配置しています。

SeedはURLクエリで変更できます。

```text
?seed=my-world
```

例: `http://localhost:5173/?seed=mountain-test`

## 開発

```bash
npm install
npm run dev
```

検証:

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

Node.js 22.12以上を使用してください。

## 操作

- WASD: 移動
- Space: ジャンプ
- Ctrl: ダッシュ
- Shift: しゃがみ
- マウス: 視点
- 1〜9: Hotbar選択
- マウスホイール: Hotbar切替
- E: Inventory / 2x2 Crafting
- 左クリック長押し: ブロック破壊
- 右クリック: 選択中block itemを設置
- Crafting Tableを右クリック: 3x3 Crafting
- Inventory左クリック: stackを持つ / 置く
- Inventoryドラッグ&ドロップ: stack移動
- Inventory右クリック: stackを半分持つ / 1個置く
- Inventory Shift+クリック: HotbarとMain間を高速移動
- Crafting Output Shift+クリック: 可能な範囲で連続craft
- Esc: ポインターロック解除 / Inventoryを閉じる
- F3: デバッグ表示

## 設計

詳細は `docs/ARCHITECTURE.md`、実装順は `docs/ROADMAP.md`、レビュー結果は `docs/REVIEW.md` を参照してください。
