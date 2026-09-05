# Phase 3 Review

## Scope

Phase 3 replaces the fixed Phase 2 test area with deterministic seeded terrain and player-following chunk streaming while preserving Phase 2 raycast, break/place and remeshing behavior.

## Implemented

- string seed -> deterministic uint32 hash
- seeded 2D value noise
- fBM and ridged fBM
- domain-warped terrain sampling
- grass / sand / exposed-stone surface selection
- hills and mountain ranges with bounded world height
- deterministic `WorldGenerator.generateChunk(chunkX, chunkZ)`
- URL query seed selection via `?seed=...`
- render-distance target planning
- nearest-first asynchronous chunk generation queue
- player chunk tracking including negative coordinates
- unload hysteresis padding
- dirty-neighbor remeshing when chunks enter/leave the loaded set
- session-local block edit cache reapplied after unload/regeneration
- generation retry with bounded failure count
- F3 seed / render distance / loaded / pending / runtime-edit diagnostics

## Review findings and fixes

- **Stale queue priority after moving**: pending targets are rebuilt whenever the player changes chunk or Render Distance, so nearest-first ordering always uses the current center.
- **Transient generation failure could become permanent**: failed jobs now retry up to two times before reporting an error.
- **Retry-state growth**: retry state is cleared when the stream plan changes and after successful generation.
- **Unloaded player edits would disappear**: break/place operations are stored in `WorldEditStore` and reapplied when a deterministic chunk is regenerated.
- **Chunk-border visuals during streaming**: `ChunkManager.add/remove` dirty adjacent chunks so exposed boundary faces are rebuilt when neighbors appear or disappear.
- **Spawn vs Phase 1 floor collision**: the inner spawn region is blended toward Y=-1 until Phase 4 replaces the temporary Y=0 floor clamp with real voxel collision.
- **Main-thread burst risk**: Phase 3 generates one chunk per scheduled task and yields between jobs. Web Worker terrain/meshing remains a Phase 10 optimization boundary.

## Automated verification

40 tests pass locally: the existing 27 Phase 1/2 tests plus 13 Phase 3 tests covering:

- seed hashing determinism
- seeded noise determinism and bounds
- query-string seed parsing
- identical terrain from identical seeds
- different terrain from different seeds
- spawn flattening
- deterministic chunk voxel content
- generated surface/depth material correctness
- Render Distance target planning
- asynchronous nearest-first generation
- negative player/chunk coordinates
- moving-center unload/reload behavior
- runtime edit reapplication
- transient generation failure retry

CI additionally runs dependency installation, strict TypeScript checking, all tests, Vite production build and high-severity npm audit.

## Known limitations

- Phase 3 async generation is cooperative event-loop scheduling, not a Web Worker. Each chunk generation still uses the main JS thread for that individual job; Worker terrain/meshing is planned for Phase 10.
- Full Voxel AABB player collision is Phase 4. Away from the flattened spawn area, the temporary Phase 1 floor clamp can visually disagree with generated terrain height.
- Biomes, caves, ore veins, trees/plants, water and lighting remain Phase 8 work.
- Runtime edits survive unload/reload only for the current page session. IndexedDB persistence is Phase 9.
- Render Distance 16-24 is accepted but has not yet received Phase 10 memory/FPS tuning; the default remains 8.
- Texture Atlas and transparent render passes are not part of this phase.

## Phase 4 readiness

World access now has a stable loaded-chunk boundary and deterministic block queries. Phase 4 can replace the temporary floor clamp with voxel AABB collision without changing world generation or stream ownership.
