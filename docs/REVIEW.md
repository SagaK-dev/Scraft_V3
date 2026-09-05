# Phase 8 Review

## Scope
Advanced WorldとしてBiome、caves、ore veins、Tree/Shrub、Sun/Block Light、Water/swimming、Weather、Structure generationを追加した。

## Review findings and fixes
1. Cross-chunk featureは隣Chunkへ直接書かずworld-space anchor再計算方式にした。
2. Waterはnon-solid liquidとしてPlayer collisionと分離した。
3. 通常Voxel Raycastはliquidをhit対象から除外した。
4. ChunkMesherをopaque/translucent index sectionへ分離した。
5. block変更時に周辺light source cacheをinvalidateしradius remeshする。
6. spawn/respawnは`max(terrain height, sea level)+1`、land Mobはliquid内standを拒否する。
7. submerged中はfall distanceをリセットする。
8. Weatherはseed+cycle決定で`Math.random()`非依存。
9. Ore thresholdはGlow 0.80 / Iron 0.72 / Coal 0.68。

## Validation
Phase 1〜7の既存testsを維持し、3D noise、biome、caves/water/ores、cross-chunk決定性、sky/block light、Water translucent mesh、Weather、radius dirtyを追加する。

最終確認はGitHub Actionsでstrict TypeScript、92 tests、Vite production build、`npm audit --audit-level=high`を実行する。

## Known limitations
- block lightは静的bounded propagation。
- Water flow simulationは未実装。
- 雷damage/積雪更新は未実装。
- Worker/Greedy Meshing/Entity LOD/bundle splittingはPhase 10。
- IndexedDB persistenceはPhase 9。
