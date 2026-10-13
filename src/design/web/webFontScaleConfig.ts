/** Discrete font-scale steps for web (default 100%). */
export const WEB_FONT_SCALE_STEPS = [0.9, 1, 1.1, 1.25, 1.5] as const;

export type WebFontScale = (typeof WEB_FONT_SCALE_STEPS)[number];

export const WEB_FONT_SCALE_DEFAULT: WebFontScale = 1;

export const WEB_FONT_SCALE_STORAGE_KEY = '@caresuite/web-font-scale';

export function isWebFontScale(value: number): value is WebFontScale {
  return (WEB_FONT_SCALE_STEPS as readonly number[]).includes(value);
}

export function formatWebFontScaleLabel(scale: WebFontScale): string {
  return `${Math.round(scale * 100)}%`;
}

export function clampWebFontScaleIndex(index: number): number {
  return Math.max(0, Math.min(WEB_FONT_SCALE_STEPS.length - 1, index));
}

export function indexOfWebFontScale(scale: WebFontScale): number {
  const idx = WEB_FONT_SCALE_STEPS.indexOf(scale);
  return idx >= 0 ? idx : WEB_FONT_SCALE_STEPS.indexOf(WEB_FONT_SCALE_DEFAULT);
}

export const DESKTOP_WORKSPACE_FONT_KEY = "@caresuite/desktop-workspace-font-scale.v2";
export function workspaceEffectiveScale(scale: WebFontScale, workspace: boolean): number {
  return scale * (workspace ? 0.9 : 1);
}

/** Saved 90% adopts the new desktop baseline; larger accessibility settings stay. */
export function normalizeDesktopFontScale(value: unknown): WebFontScale {
  return typeof value === "number" && isWebFontScale(value) && value >= WEB_FONT_SCALE_DEFAULT
    ? value
    : WEB_FONT_SCALE_DEFAULT;
}
