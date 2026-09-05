# Scraft V3

ブラウザで動作するオリジナルの3Dボクセル・サンドボックスゲームを、TypeScript / Three.js / WebGL2 / Viteで段階的に実装するプロジェクトです。

Minecraftの公式テクスチャ、音声、コード、ロゴ等は使用しません。ゲームデザイン上の一般的なボクセル・サンドボックスの操作感を参考にしつつ、素材と実装は独自にします。

## 現在の状態

Phase 8: Advanced Worldまで実装済みです。

- Phase 1: Three.js / WebGL2 / FPS視点 / 固定60Hz更新 / 設定 / F3 / CI
- Phase 2: Block / Chunk / Uint16Array / meshing / Raycast / break / place
- Phase 3: Seeded terrain / chunk streaming / Render Distance
- Phase 4: Voxel AABB / gravity / jump / crouch / step / anti-tunneling
- Phase 5: ItemRegistry / Hotbar / Inventory / Crafting / tools / durability
- Phase 6: HP/Hunger / fall damage / Day-Night / Audio / Furnace / Chest
- Phase 7: Item Drop / Pickup / Passive & Hostile Mob / AI / Projectile / bounded A*
- Phase 8: Biome / caves / ore veins / trees & shrubs / sky & block light / water / weather / ruins

### Phase 8 world generation
- 4 Biome: `plains` / `forest` / `desert` / `alpine`
- Seeded temperature/moisture climate + terrain height
- 3D seeded fBM caves
- Coal Ore / Iron Ore / Glow Crystal vein
- Glow Crystal light level 12
- sea level `Y=-2`
- Water: non-solid / translucent / replaceable liquid
- swimming: Space浮上 / Shift潜行
- deterministic Tree / Shrub
- load-order independent world-space feature anchors
- deterministic Stone Ruin structure

### Lighting / Weather
- vertical skylight + static bounded Block Light
- Water/Glass translucent render group
- Seeded `clear / rain / storm`
- Rain/Storm Line particles + Fog/Sky/Sun dimming

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
- Space: ジャンプ / 水中で浮上
- Ctrl: ダッシュ
- Shift: しゃがみ / 水中で潜行
- マウス: 視点
- 1〜9 / マウスホイール: Hotbar
- E: Inventory / 2x2 Crafting
- 左クリック: Mob攻撃 / ブロック破壊
- 右クリック: 使用 / 設置 / Container操作
- Esc: UIを閉じる / Pointer Lock解除
- F3: デバッグ表示

詳細は `docs/ARCHITECTURE.md`、`docs/ROADMAP.md`、`docs/REVIEW.md` を参照してください。
