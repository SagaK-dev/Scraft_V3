import { craftMany, craftOnce, previewCraft } from '../crafting/CraftingService';
import { CraftingGrid } from '../crafting/CraftingGrid';
import type { CraftingRegistry } from '../crafting/CraftingRegistry';
import type { ItemRegistry } from '../items/ItemRegistry';
import { canStackTogether, cloneStack, remainingDurability, type ItemStack } from '../items/ItemStack';
import { placeOne, takeHalf, transferStack, type MutableSlots } from '../inventory/Inventory';
import { HOTBAR_SIZE, type PlayerInventory } from '../inventory/PlayerInventory';

export type InventoryScreenMode = 'player' | 'crafting-table';

type SourceName = 'player' | 'craft';

interface SlotReference {
  readonly source: SourceName;
  readonly index: number;
}

export class InventoryUI {
  private readonly overlay: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly craftArea: HTMLDivElement;
  private readonly mainArea: HTMLDivElement;
  private readonly hotbarArea: HTMLDivElement;
  private readonly output: HTMLButtonElement;
  private readonly cursorView: HTMLDivElement;
  private readonly hotbarHud: HTMLDivElement;
  private readonly playerGrid = new CraftingGrid(2, 2);
  private readonly tableGrid = new CraftingGrid(3, 3);
  private mode: InventoryScreenMode = 'player';
  private cursor: ItemStack | null = null;
  private dragSource: SlotReference | null = null;
  private openState = false;

  constructor(
    root: HTMLElement,
    private readonly inventory: PlayerInventory,
    private readonly items: ItemRegistry,
    private readonly recipes: CraftingRegistry,
    private readonly onRequestClose: () => void,
  ) {
    const hotbar = document.createElement('div');
    hotbar.className = 'hotbar-hud';
    root.append(hotbar);
    this.hotbarHud = hotbar;

    const overlay = document.createElement('div');
    overlay.className = 'inventory-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="inventory-panel" aria-label="Inventory">
        <header class="inventory-header">
          <h2>Inventory</h2>
          <button type="button" data-action="close">閉じる</button>
        </header>
        <div class="crafting-section">
          <div class="craft-grid" aria-label="Crafting inputs"></div>
          <div class="craft-arrow">→</div>
          <button type="button" class="slot craft-output" aria-label="Crafting output"></button>
        </div>
        <div class="inventory-main" aria-label="Main inventory"></div>
        <div class="inventory-hotbar" aria-label="Hotbar"></div>
        <div class="inventory-help">左クリック: 持つ/置く ・ ドラッグ: 移動 ・ 右クリック: 半分/1個 ・ Shift+クリック: 高速移動</div>
      </section>
      <div class="inventory-cursor" hidden></div>`;
    root.append(overlay);
    this.overlay = overlay;
    this.title = required(overlay.querySelector<HTMLHeadingElement>('h2'));
    this.craftArea = required(overlay.querySelector<HTMLDivElement>('.craft-grid'));
    this.mainArea = required(overlay.querySelector<HTMLDivElement>('.inventory-main'));
    this.hotbarArea = required(overlay.querySelector<HTMLDivElement>('.inventory-hotbar'));
    this.output = required(overlay.querySelector<HTMLButtonElement>('.craft-output'));
    this.cursorView = required(overlay.querySelector<HTMLDivElement>('.inventory-cursor'));

    required(overlay.querySelector<HTMLButtonElement>('[data-action="close"]')).addEventListener('click', () => this.onRequestClose());
    overlay.addEventListener('mousemove', this.handleMouseMove);
    overlay.addEventListener('click', this.handleClick);
    overlay.addEventListener('contextmenu', this.handleContextMenu);
    overlay.addEventListener('dragstart', this.handleDragStart);
    overlay.addEventListener('dragover', this.handleDragOver);
    overlay.addEventListener('drop', this.handleDrop);
    overlay.addEventListener('dragend', () => { this.dragSource = null; });
    this.render();
  }

  get isOpen(): boolean {
    return this.openState;
  }

  get currentMode(): InventoryScreenMode {
    return this.mode;
  }

  open(mode: InventoryScreenMode): void {
    this.mode = mode;
    this.openState = true;
    this.overlay.hidden = false;
    this.render();
  }

  close(): boolean {
    if (!this.openState) return true;
    if (!this.returnCursor()) return false;
    if (!this.returnCraftingInputs()) return false;
    this.openState = false;
    this.overlay.hidden = true;
    this.renderHotbar();
    return true;
  }

  selectHotbar(index: number): void {
    this.inventory.selectHotbar(index);
    this.renderHotbar();
    if (this.openState) this.renderInventorySlots();
  }

  cycleHotbar(delta: number): void {
    this.inventory.cycleHotbar(delta);
    this.renderHotbar();
    if (this.openState) this.renderInventorySlots();
  }

  refresh(): void {
    this.render();
  }

  dispose(): void {
    this.overlay.removeEventListener('mousemove', this.handleMouseMove);
    this.overlay.removeEventListener('click', this.handleClick);
    this.overlay.removeEventListener('contextmenu', this.handleContextMenu);
    this.overlay.removeEventListener('dragstart', this.handleDragStart);
    this.overlay.removeEventListener('dragover', this.handleDragOver);
    this.overlay.removeEventListener('drop', this.handleDrop);
    this.overlay.remove();
    this.hotbarHud.remove();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const output = (event.target as HTMLElement).closest<HTMLButtonElement>('.craft-output');
    if (output) {
      const count = event.shiftKey ? craftMany(this.activeGrid, this.inventory, this.items, this.recipes) : Number(craftOnce(this.activeGrid, this.inventory, this.items, this.recipes).crafted);
      if (count > 0) this.render();
      return;
    }
    const slot = this.parseSlot(event.target);
    if (!slot) return;
    if (event.shiftKey) this.shiftClick(slot);
    else this.leftClick(slot);
    this.render();
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    const slot = this.parseSlot(event.target);
    if (!slot) return;
    event.preventDefault();
    this.rightClick(slot);
    this.render();
  };

  private readonly handleDragStart = (event: DragEvent): void => {
    const slot = this.parseSlot(event.target);
    if (!slot || !this.container(slot.source).get(slot.index)) {
      event.preventDefault();
      return;
    }
    this.dragSource = slot;
    event.dataTransfer?.setData('text/plain', `${slot.source}:${slot.index}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };

  private readonly handleDragOver = (event: DragEvent): void => {
    if (this.parseSlot(event.target)) event.preventDefault();
  };

  private readonly handleDrop = (event: DragEvent): void => {
    const target = this.parseSlot(event.target);
    if (!target || !this.dragSource) return;
    event.preventDefault();
    const source = this.dragSource;
    this.dragSource = null;
    if (source.source === target.source && source.index === target.index) return;
    transferStack(this.container(source.source), source.index, this.container(target.source), target.index, this.items);
    this.render();
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    this.cursorView.style.left = `${event.clientX + 14}px`;
    this.cursorView.style.top = `${event.clientY + 14}px`;
  };

  private leftClick(ref: SlotReference): void {
    const container = this.container(ref.source);
    const target = container.get(ref.index);
    if (!this.cursor) {
      if (!target) return;
      this.cursor = target;
      container.set(ref.index, null, this.items);
      return;
    }
    if (!target) {
      container.set(ref.index, this.cursor, this.items);
      this.cursor = null;
      return;
    }
    if (canStackTogether(target, this.cursor, this.items)) {
      const limit = this.items.get(target.itemId).maxStack;
      const moved = Math.min(this.cursor.count, limit - target.count);
      if (moved > 0) {
        target.count += moved;
        this.cursor.count -= moved;
        container.set(ref.index, target, this.items);
        if (this.cursor.count === 0) this.cursor = null;
      }
      return;
    }
    container.set(ref.index, this.cursor, this.items);
    this.cursor = target;
  }

  private rightClick(ref: SlotReference): void {
    const container = this.container(ref.source);
    if (!this.cursor) {
      this.cursor = takeHalf(container, ref.index, this.items);
      return;
    }
    this.cursor = placeOne(container, ref.index, this.cursor, this.items);
  }

  private shiftClick(ref: SlotReference): void {
    if (ref.source === 'player') {
      this.inventory.shiftClick(ref.index, this.items);
      return;
    }
    const grid = this.activeGrid;
    const stack = grid.get(ref.index);
    if (!stack) return;
    const remainder = this.inventory.insert(stack, this.items);
    grid.set(ref.index, remainder, this.items);
  }

  private returnCursor(): boolean {
    if (!this.cursor) return true;
    let remainder = this.inventory.insert(this.cursor, this.items);
    if (remainder) remainder = insertIntoContainer(this.activeGrid, remainder, this.items);
    this.cursor = remainder;
    this.render();
    return this.cursor === null;
  }

  private returnCraftingInputs(): boolean {
    const grid = this.activeGrid;
    for (let index = 0; index < grid.size; index += 1) {
      const stack = grid.get(index);
      if (!stack) continue;
      const remainder = this.inventory.insert(stack, this.items);
      grid.set(index, remainder, this.items);
      if (remainder) {
        this.render();
        return false;
      }
    }
    return true;
  }

  private container(source: SourceName): MutableSlots {
    return source === 'player' ? this.inventory : this.activeGrid;
  }

  private get activeGrid(): CraftingGrid {
    return this.mode === 'crafting-table' ? this.tableGrid : this.playerGrid;
  }

  private parseSlot(target: EventTarget | null): SlotReference | null {
    const element = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-slot-source]') : null;
    if (!element) return null;
    const source = element.dataset.slotSource;
    const index = Number(element.dataset.slotIndex);
    if ((source !== 'player' && source !== 'craft') || !Number.isInteger(index)) return null;
    return { source, index };
  }

  private render(): void {
    this.renderHotbar();
    if (!this.openState) return;
    this.title.textContent = this.mode === 'crafting-table' ? 'Crafting Table — 3×3' : 'Inventory — 2×2 Crafting';
    this.renderCrafting();
    this.renderInventorySlots();
    this.renderCursor();
  }

  private renderHotbar(): void {
    this.hotbarHud.replaceChildren(...Array.from({ length: HOTBAR_SIZE }, (_, index) => this.createSlot('player', index, this.inventory.get(index), index === this.inventory.selectedHotbarIndex, true)));
  }

  private renderInventorySlots(): void {
    this.mainArea.replaceChildren(...Array.from({ length: 27 }, (_, offset) => {
      const index = HOTBAR_SIZE + offset;
      return this.createSlot('player', index, this.inventory.get(index), false, false);
    }));
    this.hotbarArea.replaceChildren(...Array.from({ length: HOTBAR_SIZE }, (_, index) => this.createSlot('player', index, this.inventory.get(index), index === this.inventory.selectedHotbarIndex, false)));
  }

  private renderCrafting(): void {
    const grid = this.activeGrid;
    this.craftArea.style.gridTemplateColumns = `repeat(${grid.width}, 48px)`;
    this.craftArea.replaceChildren(...Array.from({ length: grid.size }, (_, index) => this.createSlot('craft', index, grid.get(index), false, false)));
    const preview = previewCraft(grid, this.recipes);
    this.renderSlotElement(this.output, preview, false, false);
    this.output.disabled = preview === null;
  }

  private renderCursor(): void {
    this.cursorView.hidden = this.cursor === null;
    this.renderSlotElement(this.cursorView, this.cursor, false, false);
  }

  private createSlot(source: SourceName, index: number, stack: ItemStack | null, selected: boolean, hotbarHud: boolean): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = `slot${selected ? ' selected' : ''}${hotbarHud ? ' hud-slot' : ''}`;
    slot.dataset.slotSource = source;
    slot.dataset.slotIndex = String(index);
    slot.draggable = stack !== null;
    if (hotbarHud) slot.dataset.hotbarKey = String(index + 1);
    this.renderSlotElement(slot, stack, selected, hotbarHud);
    return slot;
  }

  private renderSlotElement(element: HTMLElement, stack: ItemStack | null, _selected: boolean, hotbarHud: boolean): void {
    element.replaceChildren();
    if (!stack) return;
    const item = this.items.get(stack.itemId);
    element.title = item.tool ? `${item.name} — durability ${remainingDurability(stack, this.items)}/${item.tool.maxDurability}` : `${item.name} ×${stack.count}`;
    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.style.backgroundColor = `#${item.color.toString(16).padStart(6, '0')}`;
    icon.textContent = item.tool ? toolGlyph(item.tool.kind) : item.name.slice(0, 1).toUpperCase();
    element.append(icon);
    if (stack.count > 1) {
      const count = document.createElement('span');
      count.className = 'stack-count';
      count.textContent = String(stack.count);
      element.append(count);
    }
    if (item.tool) {
      const durability = document.createElement('span');
      durability.className = 'durability';
      const remaining = remainingDurability(stack, this.items) ?? 0;
      durability.style.setProperty('--durability', `${(remaining / item.tool.maxDurability) * 100}%`);
      element.append(durability);
    }
    if (hotbarHud) {
      const key = document.createElement('span');
      key.className = 'hotbar-key';
      key.textContent = element.dataset.hotbarKey ?? '';
      element.append(key);
    }
  }
}

function insertIntoContainer(container: MutableSlots, stack: ItemStack, items: ItemRegistry): ItemStack | null {
  let remaining = cloneStack(stack);
  for (let index = 0; index < container.size; index += 1) {
    const current = container.get(index);
    if (!current || !canStackTogether(current, remaining, items)) continue;
    const limit = items.get(current.itemId).maxStack;
    const moved = Math.min(remaining.count, limit - current.count);
    if (moved <= 0) continue;
    current.count += moved;
    remaining.count -= moved;
    container.set(index, current, items);
    if (remaining.count === 0) return null;
  }
  for (let index = 0; index < container.size; index += 1) {
    if (container.get(index)) continue;
    const limit = items.get(remaining.itemId).maxStack;
    const moved = Math.min(remaining.count, limit);
    container.set(index, { itemId: remaining.itemId, count: moved, damage: remaining.damage }, items);
    remaining.count -= moved;
    if (remaining.count === 0) return null;
  }
  return remaining;
}

function toolGlyph(kind: string): string {
  if (kind === 'pickaxe') return '⛏';
  if (kind === 'axe') return '🪓';
  return '▰';
}

function required<T>(value: T | null): T {
  if (value === null) throw new Error('Required inventory UI element was not created.');
  return value;
}
