# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 3: Seed付きワールド生成とチャンクストリーミングまで実装済みです。

- Phase 1のThree.js / WebGL2 / FPS視点 / 固定60Hz更新 / 設定 / F3 / CI
- Phase 2のBlock / Chunk / Uint16Array / meshing / Raycast / break / place
- 文字列Seedを32bit値へ決定的に変換
- Seeded Value Noise / fBM / Ridged Noise / Domain Warp
- 草地・砂地・岩肌を含む丘陵〜山岳の自然地形
- 同じSeed + 同じ座標 = 同じチャンクの決定的生成
- プレイヤーのチャンク移動に追従するロード / アンロード
- Render Distance設定を実際のストリーミング半径へ反映
- 近いチャンクを優先する非同期生成キュー
- アンロードの境界揺れを抑えるhysteresis padding
- チャンク生成失敗の制限付き再試行
- チャンクアンロード後もセッション中の破壊・設置差分を再適用
- F3にSeed / Render Distance / loaded / pending / runtime editsを表示

SeedはURLクエリで変更できます。

```text
?seed=my-world
```

例: `http://localhost:5173/?seed=mountain-test`

Phase 4ではプレイヤーの本格的なVoxel AABB衝突、段差、落下、壁抜け対策を追加します。

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
- マウス: 視点
- 左クリック長押し: ブロック破壊
- 右クリック: Dirt設置
- Esc: ポインターロック解除 / 一時停止
- F3: デバッグ表示

## 設計

詳細は `docs/ARCHITECTURE.md`、実装順は `docs/ROADMAP.md`、レビュー結果は `docs/REVIEW.md` を参照してください。
