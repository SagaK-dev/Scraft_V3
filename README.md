# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 1: ゲーム基盤

- Three.js / WebGL2 レンダリング
- Pointer Lockを使ったFPS視点
- WASD移動、Spaceジャンプ、Ctrlダッシュ
- 固定60Hz物理更新 + requestAnimationFrame描画
- FOV、マウス感度、描画距離、View Bob設定
- localStorage設定保存
- F3デバッグ表示
- WebGL context loss、タブ非表示、blur時の安全停止
- TypeScript strict設定
- Node標準テスト
- GitHub Actions CI

Phase 1では確認用の平面だけを描画します。ボクセル、チャンク、採掘、設置はPhase 2で実装します。

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
- Esc: ポインターロック解除 / 一時停止
- F3: デバッグ表示

## 設計

詳細は `docs/ARCHITECTURE.md`、実装順は `docs/ROADMAP.md`、Phase 1レビューは `docs/REVIEW.md` を参照してください。
