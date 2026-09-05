export class InputManager {
  private readonly keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private disposed = false;

  onLockChange?: (locked: boolean) => void;
  onError?: (message: string) => void;
  onDebugToggle?: () => void;

  constructor(private readonly canvas: HTMLCanvasElement) {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
    window.addEventListener('blur', this.handleBlur);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  takeMouse(): readonly [number, number] {
    const movement: readonly [number, number] = [this.mouseX, this.mouseY];
    this.mouseX = 0;
    this.mouseY = 0;
    return movement;
  }

  async lock(): Promise<void> {
    if (this.disposed || this.locked) return;
    try {
      const request = this.canvas.requestPointerLock();
      if (request && typeof (request as Promise<void>).then === 'function') await request;
    } catch {
      this.onError?.('マウス操作を開始できませんでした。画面をクリックして再試行してください。');
    }
  }

  pause(): void {
    this.keys.clear();
    this.mouseX = 0;
    this.mouseY = 0;
    if (this.locked) document.exitPointerLock();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    window.removeEventListener('blur', this.handleBlur);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'F3') {
      event.preventDefault();
      if (!event.repeat) this.onDebugToggle?.();
      return;
    }
    if (this.locked) this.keys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    this.mouseX += event.movementX;
    this.mouseY += event.movementY;
  };

  private readonly handlePointerLockChange = (): void => {
    if (!this.locked) this.keys.clear();
    this.onLockChange?.(this.locked);
  };

  private readonly handlePointerLockError = (): void => {
    this.onError?.('Pointer Lockを取得できませんでした。ブラウザ設定を確認してください。');
  };

  private readonly handleBlur = (): void => this.pause();
  private readonly preventContextMenu = (event: MouseEvent): void => event.preventDefault();
}
