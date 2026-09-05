# Phase 5 Review

## Scope

Phase 5 adds items, inventory, hotbar, crafting, block-item placement and tool durability on top of the Phase 4 voxel world and physics stack.

## Implemented

- numeric `ItemRegistry` with validation and block-item mapping
- 14 initial items including block items, Stick and four tools
- 9-slot Hotbar + 27-slot Main Inventory
- max-stack enforcement and merge into partial stacks before empty slots
- selected Hotbar slot via number keys and mouse wheel
- item cursor left-click behavior
- HTML drag/drop between inventory/crafting slots
- right-click half pickup and one-item placement
- Shift-click Hotbar/Main transfer
- 2x2 Player Crafting
- Crafting Table block + item
- right-click Crafting Table to open 3x3 Crafting
- shaped recipe matching with offsets and optional mirroring
- Planks, Stick, Crafting Table, Wooden Pickaxe/Axe/Shovel and Stone Pickaxe recipes
- recipe output capacity check before consuming ingredients
- Shift-click craft-many
- tool categories, mining speed and durability
- durability bar in UI and tool destruction at zero durability
- block break -> matching item collection into Inventory
- selected placeable item -> block placement + stack consumption
- crafting cursor/grid items returned to Inventory on close
- F3 selected Hotbar item diagnostics

## Review findings and fixes

- **Crafting output could partially mutate inventory before discovering it was full**: `canFullyInsert` is checked before ingredients are consumed. Crafting now behaves transactionally for one recipe operation.
- **Crafting grid state survived closing/reopening globally**: close now returns cursor and active grid inputs to Player Inventory. If they cannot fit, closing is refused rather than losing items.
- **Game-owned tool-category switch would become brittle**: `preferredTool` is stored on Block definitions and `ToolLogic` computes speed from Block + Item data.
- **Tool stack rules**: Item validation forces tools to maxStack 1 and rejects already-broken tool stacks.
- **Right-click split count**: odd stacks use ceil for the held half and preserve the exact total count.
- **Shift-click partial capacity**: the source retains the exact remainder when only part of a stack can move.
- **Drag/drop incompatible items**: stacks swap rather than overwriting either side.
- **Crafting close item-loss risk**: cursor return and crafting-input return are mandatory before the UI can close.
- **Pause menu / Hotbar stacking**: pause overlay is layered above the always-rendered Hotbar; Inventory overlay remains above both.
- **Phase 8 dependency for wood availability**: until trees exist, a temporary 8-Wood starter stack is provided solely so Phase 5 crafting can be exercised.

## Automated verification

57 tests pass locally: the previous 45 Phase 1-4 tests plus 12 Phase 5 tests covering:

- ItemRegistry block/tool definitions
- stack-limit validation
- durability decrement and breakage
- matching vs wrong-tool mining speed
- stack merge + overflow into empty slot
- Hotbar/Main Shift-click transfer
- right-click half split and one-item placement
- drag-style move/swap/merge
- offset-independent 2x2 Wood -> Planks
- 2x2 Crafting Table recipe
- 3x3 Wooden Pickaxe recipe and 2x2 rejection
- full-inventory craft rejection without consuming ingredients
- inventory capacity edge behavior

The Phase 5 pure TypeScript modules and Inventory UI also pass a strict standalone TypeScript check with `noUncheckedIndexedAccess` enabled. Full application typecheck/build is verified in GitHub Actions where Three.js dependencies are installed.

## Known limitations

- World item entities are Phase 7. When inventory is full, a broken block cannot yet spawn as a physical dropped entity and is reported as uncollected.
- Natural Wood supply waits for Phase 8 vegetation, so Phase 5 currently grants 8 Wood at startup as a temporary test aid.
- Crafting recipes are code-registered rather than external JSON; the registry boundary is designed so recipes can be data-driven later.
- Tools currently affect mining time and durability but do not yet gate drops by tier; ore/tier requirements belong with Phase 8 ores and Phase 6/7 survival tuning.
- Inventory and crafting state are session-only until Phase 9 IndexedDB persistence.
- Browser pointer interactions and drag/drop feel still require interactive browser testing beyond unit/CI validation.

## Phase 6 readiness

Player inventory, tools and fall-distance state now exist, so Phase 6 can add HP, hunger, regeneration, fall damage, combat, day/night, audio, furnace and chest interactions without inventing a second item model.
