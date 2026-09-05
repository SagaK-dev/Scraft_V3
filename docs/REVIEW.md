# Phase 1 Review

## Scope

Phase 1 intentionally does not implement blocks/chunks. The green plane and grid are temporary test geometry used to validate camera movement and rendering lifecycle.

## Review findings and applied fixes

- **Large-frame physics jump**: render delta is capped and simulation uses a fixed 60Hz accumulator with a maximum catch-up count.
- **Fixed-step floating-point boundary**: tests exposed a 0.03/0.01 precision edge that could skip one update; the accumulator comparison now uses a scale-aware epsilon.
- **Background-tab jump**: visibility changes reset the input state, accumulator, and previous frame timestamp.
- **Stuck movement keys**: blur and pointer-lock release clear key state.
- **Pointer Lock failure**: user-visible error path is present.
- **Context loss**: WebGL context loss stops input and animation progression and displays a fatal message.
- **GPU leaks**: Phase 1-owned geometry/materials are disposed; shared/future world resources are expected to own their own lifecycles.
- **HiDPI runaway fill rate**: pixel ratio is capped at 2.
- **Unsafe settings**: persisted values are sanitized and storage exceptions are contained.
- **Negative coordinate trap**: coordinate helper uses floor division + positive modulo in preparation for Phase 2.

## Verification matrix

Automated local tests cover:

1. fixed-step deterministic update count
2. fixed-step catch-up cap
3. negative chunk/local coordinate mapping
4. invalid coordinate divisor/modulus rejection
5. settings clamping
6. storage failure handling
7. moveTowards no-overshoot
8. moveTowards positive/negative direction
9. moveTowards stable equality
10. moveTowards invalid maxDelta rejection

CI additionally installs dependencies, runs strict TypeScript checking, executes tests, builds with Vite, and performs an npm high-severity audit.

## Known limitations

- Browser pointer-lock and actual frame-rate require a real browser/GPU run; unit tests cannot prove these.
- Phase 1 collision is only a flat Y=0 floor. Voxel AABB collision belongs to Phase 4 after Phase 2 provides blocks.
- Render Distance setting is stored now but becomes active with ChunkManager in Phase 3.
- No textures/audio are included yet, avoiding accidental use of Minecraft assets.

## Phase 2 readiness

`src/world/coordinates.ts` already establishes negative-coordinate semantics. The next phase should add BlockRegistry, Chunk, ChunkManager, ChunkMesher, VoxelRaycast and block interaction without making `Game` the owner of voxel details.
