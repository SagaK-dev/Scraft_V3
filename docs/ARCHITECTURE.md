# Architecture

Scraft V3はThree.js/WebGL2描画、60Hz固定simulation、Chunk単位Voxel world、UI/Inventory/Survival/Entityを分離したブラウザ向けボクセルサンドボックスです。

## Core
- `Game`: Input、Player、World、Inventory、Survival、Entities、Day/Night、Weatherのcomposition root。
- `Renderer`: scene/camera/WebGLRenderer、Sun/Hemisphere、Fog/Sky、WeatherRenderer。
- `FixedStep`: 60Hz fixed simulation + interpolation。

## World / Chunk
- `Chunk`: 16×256×16 `Uint16Array`。
- `ChunkManager`: signed coordinate、neighbor dirty、radius dirty。
- `ChunkStreamer`: player-follow nearest-first cooperative async generation。
- `WorldGenerator`: seedからterrain/biome/cave/ore/feature/structureを決定。
- `WorldEditStore`: deterministic baseへruntime edits再適用。

Phase 8はPlains/Forest/Desert/Alpine、sea level Y=-2、3D caves、Coal/Iron/Glow ores、Tree/Shrub、Stone Ruinを生成する。Tree/Structureは隣Chunkへ直接書かず、各Chunkがworld-space feature anchorを再計算し自Chunk内だけstampするため生成順に依存しない。

## Meshing / Lighting
`ChunkMesher`はhidden-face removalしたcombined geometryを生成し、opaque/translucent sectionを別index groupにする。Water/Glassはtransparent material。

`LightEngine`はvertical skylightとstatic block lightを計算する。Glow Crystalはlight level 12。bounded flood propagation、opaque遮断、liquid追加attenuation。編集時は周辺cache invalidate + radius remesh。

## Water / Physics
Waterはnon-solid/liquid/translucent/replaceable。通常raycastはliquidをinteraction targetにしない。Player AABBがWaterと交差するとswim modeへ入り、drag、沈降、Space浮上、Shift潜行を適用しfall distanceをリセットする。

## Weather
`WeatherSystem`はseed+cycleから`clear/rain/storm`とdurationを決定する。`WeatherRenderer`はLineSegments rainを描画し、RendererはSun/Hemisphere/Fog/Skyを連動させる。

## Entities / Items / Survival
Phase 5〜7のItemRegistry、Inventory、Crafting、Survival、Container、EntityManager/ItemDropManager/ProjectileRuntimeの責務分離を維持する。

## Future
Phase 9: IndexedDB persistence。Phase 10: Worker terrain/meshing、Greedy Meshing、code splitting、Entity LOD/low-frequency tick、pooling、memory profiling。
