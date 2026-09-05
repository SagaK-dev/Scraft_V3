# Phase 6 Review

## Scope

Phase 6 adds survival state and usable world containers on top of the Phase 5 inventory/crafting system while keeping Phase 3 streaming and Phase 4 voxel physics intact.

## Implemented

- HP 20 / Hunger 20 / saturation / exhaustion
- hunger>=18 natural regeneration and hunger=0 starvation damage
- fall damage from consumed landing distance events
- zero-HP respawn on generated surface
- melee cooldown and hand/tool damage calculation
- visible Training Target used only as a Phase 6 combat integration target; full mobs remain Phase 7
- 20-minute deterministic day/night cycle with renderer lighting/sky/fog updates
- synthesized Web Audio effects with no external copyrighted audio asset
- Furnace block/item/crafting recipe, fuel rules, input/fuel/output slots, cook progress
- Chest block/item/crafting recipe and 27-slot storage
- Container UI with click/split/Shift-transfer/drag-drop
- session-local block entity store independent of chunk load/unload
- transactional container drain before breaking Chest/Furnace
- Apple food item and temporary starter food until Phase 7/8 sources exist

## Review findings and fixes

- Container UI is opened before Pointer Lock is released so pointerlockchange cannot expose the pause overlay behind the UI.
- Furnace output is take-only; arbitrary items cannot be inserted into output.
- Furnace input/fuel slots validate smeltable/fuel items on click, drag and Shift transfer.
- Closing a Furnace never hides an invalid cursor stack inside an incompatible slot.
- Container contents are preflighted through a temporary inventory before committing a block-break drain, preventing partial item loss.
- Container block drops are included in the same preflight, so a full inventory cannot destroy the Chest/Furnace item after successfully recovering its contents.
- Landing fall distance is consumed once, preventing the same landing from applying damage on multiple ticks.
- Melee attacks use a cooldown and only supersede block breaking when the combat target is closer than the voxel hit.
- Day/night clock mapping was aligned so normalized 0.5 is 12:00/noon and normalized 0.0 is midnight.
- Furnace simulation continues while inventory/container UI is open; player survival movement simulation pauses with player control.

## Automated verification

Phase 6 adds tests for fall thresholds, regeneration, saturation-before-hunger, starvation, food clamping, day/night wrap/daylight, melee cooldown/damage, furnace smelting/output blocking, signed-coordinate block entities and transactional container draining.

CI additionally runs strict TypeScript checking, the complete test suite, Vite production build and `npm audit --audit-level=high`.

## Known limitations

- Training Target has no AI and exists only to make melee combat testable before Phase 7 mobs.
- Chest/Furnace contents and survival/time are session-local until Phase 9 IndexedDB persistence.
- Furnace currently has one initial smelting recipe (Sand -> Glass) and wood/planks/sticks as fuel; ore recipes arrive with Phase 8 ores.
- Apple/Wood starter items are temporary until natural vegetation and Mob/item-drop systems provide normal acquisition.
- Real-browser long-run FPS/audio latency still requires manual browser/GPU validation.
