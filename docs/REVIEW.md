# Phase 2 Review

## Scope

Phase 2 adds the voxel data/rendering/interaction foundation on top of Phase 1. Terrain is intentionally a fixed 5x5 chunk test area; seeded generation and streaming remain Phase 3 work.

## Implemented

- Block / BlockRegistry with stable numeric IDs, hardness, solid/opaque/placeable flags
- 16x256x16 chunks using `Uint16Array`
- world/chunk/local coordinate conversion including negative X/Z and Y range -64..191
- ChunkManager with safe unloaded-chunk behavior and dirty tracking
- chunk-level mesh generation with hidden-face culling
- neighbor-chunk lookup at chunk borders
- old BufferGeometry disposal before remesh
- voxel DDA raycast
- reusable selection outline
- hold-to-break with per-block hardness and target-change reset
- right-click placement
- player-AABB placement rejection
- adjacent-chunk remesh on border edits

## Review findings and fixes

- **Node test incompatibility**: strip-only TypeScript cannot execute constructor parameter properties; pure voxel test modules were kept strip-compatible.
- **Transparent internal faces**: equal transparent block IDs now cull their shared face instead of generating duplicate interior geometry.
- **Break/place same-frame race**: a right-click edge is consumed before break completion and ignored if the target is destroyed that frame, preventing placement against a stale hit.
- **Break target identity**: break progress keys include block ID as well as XYZ, so replacing a block at the same coordinate resets progress.
- **Chunk-border mesh invalidation**: edits at local X/Z 0 or 15 dirty the corresponding loaded neighbor.
- **Unloaded writes**: ChunkManager refuses writes into missing chunks rather than inventing partial world data.
- **Geometry lifetime**: every replaced chunk geometry is disposed before removal.

## Automated verification

27 tests currently pass locally. Phase 2 coverage includes:

- required BlockRegistry definitions and duplicate-ID rejection
- Uint16 chunk capacity
- full world/local Y conversion range
- negative-coordinate read/write
- unloaded-chunk write rejection
- boundary dirty propagation
- 6-face single voxel mesh
- same-chunk hidden-face culling
- cross-chunk hidden-face culling
- transparent-neighbor behavior
- positive and negative DDA raycast hit
- max-distance raycast miss
- player AABB placement overlap
- break duration completion and target reset

The original 10 Phase 1 tests remain in the same suite.

## Known limitations

- Browser/GPU interaction and real FPS still require an actual browser run.
- The Phase 2 world is a fixed 25-chunk flat test area. Phase 3 owns deterministic seed generation, load/unload and render-distance streaming.
- Player movement still uses the Phase 1 flat-floor clamp. Full voxel AABB movement collision, step handling and anti-tunneling are Phase 4.
- Phase 2 uses original vertex colors rather than a texture atlas. Atlas-backed block textures are an upcoming rendering extension; no Minecraft assets are used.
- Leaves/glass have non-opaque culling semantics but are rendered by the shared opaque material in this phase; a transparent render pass belongs to later rendering work.

## Phase 3 readiness

World data, meshing and interaction are separated from `Game`. Chunk creation can therefore be replaced by a deterministic generator and streaming queue without changing raycast/break/place semantics.
