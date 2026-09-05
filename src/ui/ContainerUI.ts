import { canStackTogether, cloneStack, remainingDurability, type ItemStack } from '../items/ItemStack';
import type { ItemRegistry } from '../items/ItemRegistry';
import { placeOne, takeHalf, transferStack, type MutableSlots } from '../inventory/Inventory';
import { HOTBAR_SIZE, type PlayerInventory } from '../inventory/PlayerInventory';
import { FURNACE_FUEL_SLOT, FURNACE_INPUT_SLOT, FURNACE_OUTPUT_SLOT, type FurnaceState } from '../containers/FurnaceState';

export type ContainerMode = 'chest' | 'furnace';
type SlotSource = 'player' | 'container';
interface SlotRef { readonly source: SlotSource; readonly index: number; }

export class ContainerUI {
  private readonly overlay: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly containerArea: HTMLDivElement;
  private readonly mainArea: HTMLDivElement;
  private readonly hotbarArea: HTMLDivElement;
  private readonly cursorView: HTMLDivElement;
  private readonly progress: HTMLDivElement;
  private mode: ContainerMode = 'chest';
  private container: MutableSlots | null = null;
  private furnace: FurnaceState | null = null;
  private cursor: ItemStack | null = null;
  private dragSource: SlotRef | null = null;
  private openState = false;

  constructor(
    root: HTMLElement,
    private readonly inventory: PlayerInventory,
    private readonly items: ItemRegistry,
    private readonly onRequestClose: () => void,
  ) {
    const overlay = document.createElement('div');
    overlay.className = 'container-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="container-panel" aria-label="Container">
        <header class="inventory-header"><h2>Container</h2><button type="button" data-action="close">閉じる</button></header>
        <div class="container-progress" hidden><span data-burn></span><span data-cook></span></div>
        <div class="container-slots"></div>
        <div class="inventory-main"></div>
        <div class="inventory-hotbar"></div>
        <div class="inventory-help">左クリック: 持つ/置く ・ 右クリック: 半分/1個 ・ Shift+クリック: 高速移動</div>
      </section>
      <div class="inventory-cursor" hidden></div>`;
    root.append(overlay);
    this.overlay = overlay;
    this.title = required(overlay.querySelector<HTMLHeadingElement>('h2'));
    this.containerArea = required(overlay.querySelector<HTMLDivElement>('.container-slots'));
    this.mainArea = required(overlay.querySelector<HTMLDivElement>('.inventory-main'));
    this.hotbarArea = required(overlay.querySelector<HTMLDivElement>('.inventory-hotbar'));
    this.cursorView = required(overlay.querySelector<HTMLDivElement>('.inventory-cursor'));
    this.progress = required(overlay.querySelector<HTMLDivElement>('.container-progress'));
    required(overlay.querySelector<HTMLButtonElement>('[data-action="close"]')).addEventListener('click', this.handleClose);
    overlay.addEventListener('mousemove', this.handleMouseMove);
    overlay.addEventListener('click', this.handleClick);
    overlay.addEventListener('contextmenu', this.handleContextMenu);
    overlay.addEventListener('dragstart', this.handleDragStart);
    overlay.addEventListener('dragover', this.handleDragOver);
    overlay.addEventListener('drop', this.handleDrop);
    overlay.addEventListener('dragend', this.handleDragEnd);
  }

  get isOpen(): boolean { return this.openState; }
  get currentMode(): ContainerMode { return this.mode; }

  openChest(container: MutableSlots): void {
    this.mode = 'chest';
    this.container = container;
    this.furnace = null;
    this.openState = true;
    this.overlay.hidden = false;
    this.render();
  }

  openFurnace(furnace: FurnaceState): void {
    this.mode = 'furnace';
    this.container = furnace.inventory;
    this.furnace = furnace;
    this.openState = true;
    this.overlay.hidden = false;
    this.render();
  }

  close(): boolean {
    if (!this.openState) return true;
    if (!this.returnCursor()) return false;
    this.openState = false;
    this.overlay.hidden = true;
    this.container = null;
    this.furnace = null;
    return true;
  }

  refresh(): void { if (this.openState) this.render(); }

  dispose(): void {
    this.overlay.removeEventListener('mousemove', this.handleMouseMove);
    this.overlay.removeEventListener('click', this.handleClick);
    this.overlay.removeEventListener('contextmenu', this.handleContextMenu);
    this.overlay.removeEventListener('dragstart', this.handleDragStart);
    this.overlay.removeEventListener('dragover', this.handleDragOver);
    this.overlay.removeEventListener('drop', this.handleDrop);
    this.overlay.removeEventListener('dragend', this.handleDragEnd);
    this.overlay.remove();
  }

  private readonly handleClose = (): void => this.onRequestClose();
  private readonly handleDragEnd = (): void => { this.dragSource = null; };
  private readonly handleMouseMove = (event: MouseEvent): void => {
    this.cursorView.style.left = `${event.clientX + 14}px`;
    this.cursorView.style.top = `${event.clientY + 14}px`;
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const ref = this.parseSlot(event.target);
    if (!ref) return;
    if (event.shiftKey) this.shiftClick(ref);
    else this.leftClick(ref);
    this.render();
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    const ref = this.parseSlot(event.target);
    if (!ref) return;
    event.preventDefault();
    this.rightClick(ref);
    this.render();
  };

  private readonly handleDragStart = (event: DragEvent): void => {
    const ref = this.parseSlot(event.target);
    if (!ref || !this.source(ref).get(ref.index) || (ref.source === 'container' && !this.canDragFromContainer(ref.index))) {
      event.preventDefault();
      return;
    }
    this.dragSource = ref;
    event.dataTransfer?.setData('text/plain', `${ref.source}:${ref.index}`);
  };

  private readonly handleDragOver = (event: DragEvent): void => {
    const ref = this.parseSlot(event.target);
    const sourceStack = this.dragSource ? this.source(this.dragSource).get(this.dragSource.index) : null;
    if (ref && sourceStack && this.canAccept(ref, sourceStack.itemId)) event.preventDefault();
  };

  private readonly handleDrop = (event: DragEvent): void => {
    const target = this.parseSlot(event.target);
    const source = this.dragSource;
    this.dragSource = null;
    if (!target || !source) return;
    const sourceStack = this.source(source).get(source.index);
    if (!sourceStack || !this.canAccept(target, sourceStack.itemId)) return;
    event.preventDefault();
    if (source.source === target.source && source.index === target.index) return;
    transferStack(this.source(source), source.index, this.source(target), target.index, this.items);
    this.render();
  };

  private leftClick(ref: SlotRef): void {
    const source = this.source(ref);
    const target = source.get(ref.index);
    if (!this.cursor) {
      if (!target) return;
      this.cursor = target;
      source.set(ref.index, null, this.items);
      return;
    }
    if (!this.canAccept(ref, this.cursor.itemId)) return;
    if (!target) {
      source.set(ref.index, this.cursor, this.items);
      this.cursor = null;
      return;
    }
    if (canStackTogether(target, this.cursor, this.items)) {
      const limit = this.items.get(target.itemId).maxStack;
      const moved = Math.min(this.cursor.count, limit - target.count);
      target.count += moved;
      this.cursor.count -= moved;
      source.set(ref.index, target, this.items);
      if (this.cursor.count === 0) this.cursor = null;
      return;
    }
    source.set(ref.index, this.cursor, this.items);
    this.cursor = target;
  }

  private rightClick(ref: SlotRef): void {
    const source = this.source(ref);
    if (!this.cursor) {
      this.cursor = takeHalf(source, ref.index, this.items);
      return;
    }
    if (!this.canAccept(ref, this.cursor.itemId)) return;
    this.cursor = placeOne(source, ref.index, this.cursor, this.items);
  }

  private shiftClick(ref: SlotRef): void {
    if (!this.container) return;
    if (ref.source === 'container') {
      const stack = this.container.get(ref.index);
      if (!stack) return;
      const remainder = this.inventory.insert(stack, this.items);
      this.container.set(ref.index, remainder, this.items);
      return;
    }
    const stack = this.inventory.get(ref.index);
    if (!stack) return;
    if (this.mode === 'furnace' && this.furnace) {
      const target = this.furnace.canAcceptFuel(stack.itemId) ? FURNACE_FUEL_SLOT : this.furnace.canAcceptInput(stack.itemId) ? FURNACE_INPUT_SLOT : -1;
      if (target < 0) return;
      const remainder = insertIntoSlot(this.container, target, stack, this.items);
      this.inventory.set(ref.index, remainder, this.items);
      return;
    }
    const remainder = insertIntoContainer(this.container, stack, this.items);
    this.inventory.set(ref.index, remainder, this.items);
  }

  private returnCursor(): boolean {
    if (!this.cursor) return true;
    let remainder = this.inventory.insert(this.cursor, this.items);
    if (remainder && this.container) {
      if (this.mode === 'chest') remainder = insertIntoContainer(this.container, remainder, this.items);
      else if (this.furnace?.canAcceptFuel(remainder.itemId)) remainder = insertIntoContainer(this.container, remainder, this.items, [FURNACE_FUEL_SLOT]);
      else if (this.furnace?.canAcceptInput(remainder.itemId)) remainder = insertIntoContainer(this.container, remainder, this.items, [FURNACE_INPUT_SLOT]);
    }
    this.cursor = remainder;
    this.render();
    return this.cursor === null;
  }

  private source(ref: SlotRef): MutableSlots {
    if (ref.source === 'player') return this.inventory;
    if (!this.container) throw new Error('Container UI has no open container.');
    return this.container;
  }

  private canAccept(ref: SlotRef, itemId: number): boolean {
    if (ref.source === 'player' || this.mode === 'chest') return true;
    if (!this.furnace || ref.index === FURNACE_OUTPUT_SLOT) return false;
    if (ref.index === FURNACE_INPUT_SLOT) return this.furnace.canAcceptInput(itemId);
    if (ref.index === FURNACE_FUEL_SLOT) return this.furnace.canAcceptFuel(itemId);
    return false;
  }

  private canDragFromContainer(index: number): boolean {
    return !(this.mode === 'furnace' && index === FURNACE_OUTPUT_SLOT);
  }

  private parseSlot(target: EventTarget | null): SlotRef | null {
    const element = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-container-source]') : null;
    if (!element) return null;
    const source = element.dataset.containerSource;
    const index = Number(element.dataset.containerIndex);
    if ((source !== 'player' && source !== 'container') || !Number.isInteger(index)) return null;
    return { source, index };
  }

  private render(): void {
    if (!this.openState || !this.container) return;
    this.title.textContent = this.mode === 'chest' ? 'Chest — 27 slots' : 'Furnace';
    this.containerArea.className = `container-slots ${this.mode}`;
    this.containerArea.replaceChildren(...Array.from({ length: this.container.size }, (_, index) => this.createSlot('container', index, this.container!.get(index), this.mode === 'furnace' ? ['Input', 'Fuel', 'Output'][index] : undefined)));
    this.mainArea.replaceChildren(...Array.from({ length: 27 }, (_, offset) => { const index = HOTBAR_SIZE + offset; return this.createSlot('player', index, this.inventory.get(index)); }));
    this.hotbarArea.replaceChildren(...Array.from({ length: HOTBAR_SIZE }, (_, index) => this.createSlot('player', index, this.inventory.get(index))));
    this.renderProgress();
    this.renderCursor();
  }

  private renderProgress(): void {
    this.progress.hidden = this.mode !== 'furnace' || !this.furnace;
    if (!this.furnace) return;
    this.progress.style.setProperty('--burn', `${this.furnace.burnFraction * 100}%`);
    this.progress.style.setProperty('--cook', `${this.furnace.cookFraction * 100}%`);
  }

  private renderCursor(): void {
    this.cursorView.hidden = this.cursor === null;
    renderSlotElement(this.cursorView, this.cursor, this.items);
  }

  private createSlot(source: SlotSource, index: number, stack: ItemStack | null, label?: string): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.containerSource = source;
    slot.dataset.containerIndex = String(index);
    slot.draggable = stack !== null && !(this.mode === 'furnace' && source === 'container' && index === FURNACE_OUTPUT_SLOT);
    renderSlotElement(slot, stack, this.items);
    if (label) { const tag = document.createElement('small'); tag.className = 'slot-label'; tag.textContent = label; slot.append(tag); }
    return slot;
  }
}

function insertIntoContainer(container: MutableSlots, stack: ItemStack, items: ItemRegistry, indices?: readonly number[]): ItemStack | null {
  let remaining = cloneStack(stack);
  const targets = indices ?? Array.from({ length: container.size }, (_, index) => index);
  for (const index of targets) {
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
  for (const index of targets) {
    if (container.get(index)) continue;
    const limit = items.get(remaining.itemId).maxStack;
    const moved = Math.min(remaining.count, limit);
    container.set(index, { itemId: remaining.itemId, count: moved, damage: remaining.damage }, items);
    remaining.count -= moved;
    if (remaining.count === 0) return null;
  }
  return remaining;
}

function insertIntoSlot(container: MutableSlots, index: number, stack: ItemStack, items: ItemRegistry): ItemStack | null {
  return insertIntoContainer(container, stack, items, [index]);
}

function renderSlotElement(element: HTMLElement, stack: ItemStack | null, items: ItemRegistry): void {
  element.replaceChildren();
  if (!stack) return;
  const item = items.get(stack.itemId);
  element.title = item.tool ? `${item.name} — durability ${remainingDurability(stack, items)}/${item.tool.maxDurability}` : `${item.name} ×${stack.count}`;
  const icon = document.createElement('span');
  icon.className = 'item-icon';
  icon.style.backgroundColor = `#${item.color.toString(16).padStart(6, '0')}`;
  icon.textContent = item.tool ? (item.tool.kind === 'pickaxe' ? '⛏' : item.tool.kind === 'axe' ? '🪓' : '▰') : item.name.slice(0, 1).toUpperCase();
  element.append(icon);
  if (stack.count > 1) { const count = document.createElement('span'); count.className = 'stack-count'; count.textContent = String(stack.count); element.append(count); }
  if (item.tool) { const bar = document.createElement('span'); bar.className = 'durability'; const remaining = remainingDurability(stack, items) ?? 0; bar.style.setProperty('--durability', `${(remaining / item.tool.maxDurability) * 100}%`); element.append(bar); }
}

function required<T>(value: T | null): T { if (value === null) throw new Error('Required container UI element was not created.'); return value; }
