# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 4: Voxel AABBプレイヤー物理まで実装済みです。

- Phase 1のThree.js / WebGL2 / FPS視点 / 固定60Hz更新 / 設定 / F3 / CI
- Phase 2のBlock / Chunk / Uint16Array / meshing / Raycast / break / place
- Phase 3のSeeded Noise地形 / 決定的生成 / player-follow chunk streaming / Render Distance
- 立位0.6 x 1.8 x 0.6、しゃがみ0.6 x 1.5 x 0.6のVoxel AABB
- 地面・壁・天井のsolid block衝突
- 重力 / ジャンプ / 落下 / terminal velocity
- 移動経路全体を走査するswept collisionによる壁抜け防止
- 1ブロック自然地形のauto-step
- Shiftしゃがみ、低速移動、天井下での立ち上がり防止、崖端落下抑制
- Fall distance追跡（ダメージ適用はPhase 6）
- Seed地形の実際の表面へ動的スポーン
- Player周囲3x3のphysics safety chunkを同期確保し、遠距離はPhase 3の非同期生成を維持
- F3にgrounded / crouched / fall distanceを追加

SeedはURLクエリで変更できます。

```text
?seed=my-world
```

例: `http://localhost:5173/?seed=mountain-test`

Phase 5ではItemRegistry、Hotbar、Inventory、Crafting、Tools/Durabilityへ進みます。

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
- 左クリック長押し: ブロック破壊
- 右クリック: Dirt設置
- Esc: ポインターロック解除 / 一時停止
- F3: デバッグ表示

## 設計

詳細は `docs/ARCHITECTURE.md`、実装順は `docs/ROADMAP.md`、レビュー結果は `docs/REVIEW.md` を参照してください。
