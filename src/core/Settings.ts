export interface GameSettings {
  readonly renderDistance: number;
  readonly fov: number;
  readonly sensitivity: number;
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly viewBob: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = Object.freeze({
  renderDistance: 8,
  fov: 75,
  sensitivity: 0.12,
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  viewBob: true,
});

const STORAGE_KEY = 'scraft-v3.settings.v1';

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function sanitizeSettings(value: Partial<GameSettings> | null | undefined): GameSettings {
  return {
    renderDistance: Math.round(clamp(value?.renderDistance, 2, 24, DEFAULT_SETTINGS.renderDistance)),
    fov: clamp(value?.fov, 50, 110, DEFAULT_SETTINGS.fov),
    sensitivity: clamp(value?.sensitivity, 0.02, 0.5, DEFAULT_SETTINGS.sensitivity),
    masterVolume: clamp(value?.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
    musicVolume: clamp(value?.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clamp(value?.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
    viewBob: typeof value?.viewBob === 'boolean' ? value.viewBob : DEFAULT_SETTINGS.viewBob,
  };
}

export function loadSettings(storage?: Pick<Storage, 'getItem'>): GameSettings {
  const target = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  if (!target) return DEFAULT_SETTINGS;
  try {
    const raw = target.getItem(STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw) as Partial<GameSettings>) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings, storage?: Pick<Storage, 'setItem'>): boolean {
  const target = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  if (!target) return false;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
