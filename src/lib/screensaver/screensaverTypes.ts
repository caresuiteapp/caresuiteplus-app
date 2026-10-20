export type ScreensaverMode = 'off' | 'logo_static' | 'logo_bounce' | 'clock' | 'clock_date';

export type ScreensaverLogoSize = 'small' | 'medium' | 'large';

export type ScreensaverBounceSpeed = 'slow' | 'normal' | 'fast';

export type ScreensaverTimeoutMinutes = 1 | 2 | 5 | 10 | 15 | 30 | 60;

export type ScreensaverSettings = {
  enabled: boolean;
  timeoutMinutes: ScreensaverTimeoutMinutes;
  mode: ScreensaverMode;
  logoSize: ScreensaverLogoSize;
  bounceSpeed: ScreensaverBounceSpeed;
  showSeconds: boolean;
  use24h: boolean;
  showDate: boolean;
  showWeekday: boolean;
};

export const SCREENSAVER_TIMEOUT_OPTIONS: ScreensaverTimeoutMinutes[] = [
  1, 2, 5, 10, 15, 30, 60,
];

export const DEFAULT_SCREENSAVER_SETTINGS: ScreensaverSettings = {
  enabled: true,
  timeoutMinutes: 10,
  mode: 'logo_bounce',
  logoSize: 'medium',
  bounceSpeed: 'normal',
  showSeconds: true,
  use24h: true,
  showDate: true,
  showWeekday: true,
};

export const SCREENSAVER_MODE_LABELS: Record<ScreensaverMode, string> = {
  off: 'Aus',
  logo_static: 'Logo statisch',
  logo_bounce: 'Logo bewegt',
  clock: 'Uhrzeit',
  clock_date: 'Uhrzeit mit Datum',
};

export function isScreensaverMode(value: string): value is ScreensaverMode {
  return (
    value === 'off' ||
    value === 'logo_static' ||
    value === 'logo_bounce' ||
    value === 'clock' ||
    value === 'clock_date'
  );
}

export function isScreensaverTimeoutMinutes(value: number): value is ScreensaverTimeoutMinutes {
  return SCREENSAVER_TIMEOUT_OPTIONS.includes(value as ScreensaverTimeoutMinutes);
}

export function normalizeScreensaverSettings(
  raw: Partial<ScreensaverSettings> | null | undefined,
): ScreensaverSettings {
  const base = { ...DEFAULT_SCREENSAVER_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;

  if (typeof raw.enabled === 'boolean') base.enabled = raw.enabled;
  if (raw.timeoutMinutes !== undefined && isScreensaverTimeoutMinutes(raw.timeoutMinutes)) {
    base.timeoutMinutes = raw.timeoutMinutes;
  }
  if (raw.mode && isScreensaverMode(raw.mode)) base.mode = raw.mode;
  if (raw.logoSize === 'small' || raw.logoSize === 'medium' || raw.logoSize === 'large') {
    base.logoSize = raw.logoSize;
  }
  if (raw.bounceSpeed === 'slow' || raw.bounceSpeed === 'normal' || raw.bounceSpeed === 'fast') {
    base.bounceSpeed = raw.bounceSpeed;
  }
  if (typeof raw.showSeconds === 'boolean') base.showSeconds = raw.showSeconds;
  if (typeof raw.use24h === 'boolean') base.use24h = raw.use24h;
  if (typeof raw.showDate === 'boolean') base.showDate = raw.showDate;
  if (typeof raw.showWeekday === 'boolean') base.showWeekday = raw.showWeekday;

  if (base.mode === 'off') base.enabled = false;
  if (!base.enabled && base.mode !== 'off') {
    // keep mode for when user re-enables
  }

  return base;
}

export function validateScreensaverSettingsPatch(
  patch: Partial<ScreensaverSettings>,
): Partial<ScreensaverSettings> | null {
  const next: Partial<ScreensaverSettings> = {};
  if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') return null;
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.timeoutMinutes !== undefined && !isScreensaverTimeoutMinutes(patch.timeoutMinutes)) {
    return null;
  }
  if (patch.timeoutMinutes !== undefined) next.timeoutMinutes = patch.timeoutMinutes;
  if (patch.mode !== undefined && !isScreensaverMode(patch.mode)) return null;
  if (patch.mode !== undefined) next.mode = patch.mode;
  if (
    patch.logoSize !== undefined &&
    patch.logoSize !== 'small' &&
    patch.logoSize !== 'medium' &&
    patch.logoSize !== 'large'
  ) {
    return null;
  }
  if (patch.logoSize !== undefined) next.logoSize = patch.logoSize;
  if (
    patch.bounceSpeed !== undefined &&
    patch.bounceSpeed !== 'slow' &&
    patch.bounceSpeed !== 'normal' &&
    patch.bounceSpeed !== 'fast'
  ) {
    return null;
  }
  if (patch.bounceSpeed !== undefined) next.bounceSpeed = patch.bounceSpeed;
  if (patch.showSeconds !== undefined && typeof patch.showSeconds !== 'boolean') return null;
  if (patch.showSeconds !== undefined) next.showSeconds = patch.showSeconds;
  if (patch.use24h !== undefined && typeof patch.use24h !== 'boolean') return null;
  if (patch.use24h !== undefined) next.use24h = patch.use24h;
  if (patch.showDate !== undefined && typeof patch.showDate !== 'boolean') return null;
  if (patch.showDate !== undefined) next.showDate = patch.showDate;
  if (patch.showWeekday !== undefined && typeof patch.showWeekday !== 'boolean') return null;
  if (patch.showWeekday !== undefined) next.showWeekday = patch.showWeekday;
  return next;
}

export function screensaverIsActive(settings: ScreensaverSettings): boolean {
  return settings.enabled && settings.mode !== 'off';
}

export const BOUNCE_SPEED_PX_PER_SEC: Record<ScreensaverBounceSpeed, number> = {
  slow: 40,
  normal: 70,
  fast: 110,
};

export const LOGO_SIZE_PX: Record<ScreensaverLogoSize, number> = {
  small: 160,
  medium: 240,
  large: 320,
};
