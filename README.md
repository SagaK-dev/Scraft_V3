# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 2: ボクセルシステムまで実装済みです。

- Phase 1のThree.js / WebGL2 / FPS視点 / 固定60Hz更新 / 設定 / F3 / CI
- Block / BlockRegistry
- 16 x 256 x 16 Chunk + `Uint16Array` voxel storage
- ChunkManagerと負数ワールド座標対応
- 見えている面だけを生成するチャンク単位BufferGeometry
- 隣接チャンクを考慮した面カリング
- チャンク境界編集時の隣接再メッシュ
- DDA方式Voxel Raycast
- 選択ブロックのアウトライン表示
- 左クリック長押し破壊（Block hardness対応）
- 右クリックによるDirt設置
- プレイヤーAABBと重なる位置への設置防止
- Geometry再生成時の旧Geometry dispose
- Phase 2確認用の固定25チャンク平坦ワールド

Phase 3でSeed付き地形生成とチャンクストリーミングを追加します。プレイヤーとボクセルの本格的な衝突解決はPhase 4です。

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
