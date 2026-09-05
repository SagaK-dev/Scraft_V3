# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 7: Entities / Mobs / Item Drops / Projectilesまで実装済みです。

- Phase 1: Three.js / WebGL2 / FPS視点 / 固定60Hz更新 / 設定 / F3 / CI
- Phase 2: Block / Chunk / Uint16Array / meshing / Raycast / break / place
- Phase 3: Seeded Noise地形 / 決定的生成 / chunk streaming / Render Distance
- Phase 4: Voxel AABB / gravity / jump / crouch / step / anti-tunneling
- Phase 5: ItemRegistry / Hotbar / Inventory / 2x2・3x3 Crafting / tools / durability
- Phase 6: HP/Hunger / fall damage / Day-Night / Audio / Furnace / Chest
- EntityManagerでMob / Item Drop / Projectileのlifecycleを管理
- Block・Chest・Furnace・Mobのdropを地面のItem Drop Entityへ統一
- Item Dropは重力・地面衝突・bounce・drag・pickup delay・5分lifetimeを持つ
- Player AABB近傍で自動Pickupし、Inventoryへ一部しか入らない場合は残数を地面に保持
- 近距離の同種Item Dropをstack上限までmerge
- Passive Mob `Grazer`: 徘徊、被弾時の逃走、Apple drop
- Hostile Mob `Stalker`: 夜間spawn、Player検知、追跡、近接攻撃、遠距離Projectile、Stone drop
- Seed + spawn cycleから決定的にspawn候補を生成し、昼夜・個体数cap・距離で制御
- spawn距離14〜28 blocks、passive cap 6、hostile cap 8、52 blocks超でdespawn
- bounded A*による簡易Pathfinding（4方向、段差対応、探索node/path長上限）
- Mob移動もVoxel AABB collision / gravity / 1-block stepを使用
- Mob被弾・Player被弾のknockback
- Projectileは移動区間のcontinuous collisionで壁・Playerとの最近接hitを解決
- Stalkerの近接攻撃はLine of Sightと高低差制限を要求し、壁越し攻撃を防止
- F3にEntity / Passive / Hostile / Item Drop / Projectile数を追加

Phase 8ではBiome、洞窟、鉱石、木・植物、Sun/Block Light、水、天候、structure extension pointsへ進みます。

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
- 左クリック: Mobへ近接攻撃 / ブロック長押し破壊
- 右クリック: food使用 / block設置 / Crafting Table / Furnace / Chest操作
- Inventory/Container 左クリック: stackを持つ / 置く
- 右クリック: stackを半分持つ / 1個置く
- Shift+クリック: 高速移動
- Esc: UIを閉じる / Pointer Lock解除
- F3: デバッグ表示

## 設計

詳細は `docs/ARCHITECTURE.md`、実装順は `docs/ROADMAP.md`、レビュー結果は `docs/REVIEW.md` を参照してください。
