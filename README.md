# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 6: Survival / Combat / Day-Night / Audio / Furnace / Chestまで実装済みです。

- Phase 1: Three.js / WebGL2 / FPS視点 / 固定60Hz更新 / 設定 / F3 / CI
- Phase 2: Block / Chunk / Uint16Array / meshing / Raycast / break / place
- Phase 3: Seeded Noise地形 / 決定的生成 / chunk streaming / Render Distance
- Phase 4: Voxel AABB / gravity / jump / crouch / step / anti-tunneling
- Phase 5: ItemRegistry / Hotbar / Inventory / 2x2・3x3 Crafting / tools / durability
- HP 20 / Hunger 20 / saturation / movement exhaustion
- Hunger 18以上で自然回復、Hunger 0で飢餓ダメージ
- 3ブロックを超える落下距離に応じた落下ダメージ
- HP 0で安全なSeed地形スポーンへリスポーン
- hand/tool別の近接ダメージ、0.5秒attack cooldown、tool durability消費
- Phase 7前の戦闘確認用Training Target（8秒後リスポーン）
- 20分周期のDay/Night、太陽位置・空色・Fog・環境光を連動
- Web Audio APIで生成する独自効果音（外部音源asset不使用）
- Furnace block / 3 slots / fuel / progress / Sand -> Glass smelting
- Chest block / 27 slots
- Furnace / Chestのsession-local block entity保持
- Container UIで左/右/Shift click、drag/drop
- Container破壊時は内容物と本体をInventoryへtransactionalに回収し、入り切らなければ破壊を止める
- Furnace recipe: Stone 8個を3x3外周
- Chest recipe: Wooden Planks 8個を3x3外周

Phase 7/8で自然な食料・Mob dropが入るまでは、Survival動作確認用として開始時にAppleを4個仮配置しています。Wood 8個のCrafting確認用starterも継続しています。

SeedはURLクエリで変更できます。

```text
?seed=my-world
```

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
- 1〜9 / マウスホイール: Hotbar
- E: Inventory / 2x2 Crafting
- 左クリック: Training Targetへ近接攻撃 / ブロック長押し破壊
- 右クリック: food使用 / block設置 / Crafting Table / Furnace / Chest操作
- Inventory/Container 左クリック: stackを持つ / 置く
- 右クリック: stackを半分持つ / 1個置く
- Shift+クリック: 高速移動
- Esc: UIを閉じる / Pointer Lock解除
- F3: デバッグ表示

## 設計

詳細は `docs/ARCHITECTURE.md`、実装順は `docs/ROADMAP.md`、レビュー結果は `docs/REVIEW.md` を参照してください。
