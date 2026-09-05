# Phase 4 Review

## Scope

Phase 4 replaces the temporary Phase 1 Y=0 floor clamp with real voxel collision against the streamed Phase 3 world. Player motion, crouching, jumping, falling and step handling now use world block data.

## Implemented

- standing player AABB: 0.6 x 1.8 x 0.6
- crouched AABB: 0.6 x 1.5 x 0.6
- standing/crouched eye-height switching while preserving feet position
- Shift crouch and reduced crouch speed
- blocked stand-up when ceiling space is occupied
- gravity and terminal velocity
- grounded / wall / ceiling collision detection
- jumping from voxel surfaces
- swept axis collision over the full movement path
- high-speed anti-tunneling against one-block-thick walls/floors/ceilings
- one-block terrain auto-step while grounded and standing
- crouch edge protection by retaining support under the player
- fall-distance tracking for future Phase 6 fall damage
- dynamic spawn placement on top of generated terrain
- removal of the Phase 3 forced-flat spawn terrain workaround
- synchronous 3x3 physics safety neighborhood around the current player chunk
- Phase 3 Render Distance streaming remains asynchronous outside that safety neighborhood
- F3 grounded/crouched/fall-distance diagnostics

## Review findings and fixes

- **Generated terrain vs temporary floor mismatch**: removed the hardcoded floor clamp and place the player one block above the deterministic generated surface.
- **High-speed tunneling**: collision scans the swept broadphase and clamps axis displacement at the earliest solid voxel face instead of testing only the destination AABB.
- **Falling before async spawn chunks arrive**: the immediate 3x3 chunk neighborhood is generated synchronously before physics starts; the rest of Render Distance remains on the Phase 3 asynchronous queue.
- **Unloaded boundary safety**: collision treats a missing chunk as solid. The 3x3 safety neighborhood prevents normal movement from seeing those temporary barriers while protecting against falling into unloaded space.
- **Standing inside ceilings after crouch**: uncrouch first checks the full standing AABB and remains crouched when blocked.
- **Crouch walking off ledges**: grounded crouch motion is binary-clamped to the furthest supported position.
- **Natural one-block terrain becoming tedious**: grounded standing movement can auto-step one full voxel when headroom exists; two-block walls still block movement.
- **Fall state leaking across landings**: fall distance resets on landing while the last landed distance is retained for the future survival/damage layer.

## Automated verification

45 tests pass locally: the existing 40 Phase 1-3 tests plus 5 Phase 4 physics tests covering:

- falling onto a voxel floor and becoming grounded
- ceiling collision
- swept anti-tunneling across a 5-block horizontal motion
- one-block auto-step
- crouch-style supported ledge movement

Existing world-generation tests were updated so spawn terrain is no longer required to be artificially fixed at Y=-1.

CI additionally installs dependencies, runs strict TypeScript checking, all tests, Vite production build and high-severity npm audit.

## Known limitations

- Fall distance is tracked but fall damage belongs to Phase 6 with HP/survival state.
- Water/swimming physics waits for the Phase 8 water implementation.
- Crouch currently changes stance/eye height and edge safety; crawling/prone poses are not implemented.
- The one-block auto-step is intentionally generous for current full-block natural terrain. When slabs/stairs are added, collision shapes and step policy should become shape-aware.
- The physics safety ring synchronously generates at most 3x3 chunks around the player when entering a new chunk; distant chunks still use cooperative asynchronous generation. Web Worker terrain/meshing remains Phase 10.
- Browser/GPU feel, real FPS and long-session movement still require an interactive browser run.

## Phase 5 readiness

Player location, collision bounds, grounded/crouched state and stable block interaction now share the same voxel world. Phase 5 can add ItemRegistry, hotbar/inventory/crafting/tools without relying on the old flat-floor compatibility path.
