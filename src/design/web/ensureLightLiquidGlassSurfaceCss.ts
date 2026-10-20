import { Platform } from 'react-native';
import { getLlganCssVars } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import {
  LLGAN_GLASS_SURFACE_CSS,
  LLGAN_GLASS_SURFACE_STYLE_ID,
} from '@/design/web/lightLiquidGlassSurfaceCss';

let injected = false;

/** Inject LLGAN milchglas surface CSS once (web only). */
export function ensureLightLiquidGlassSurfaceCss(intensity: 'default' | 'strong' = 'strong'): void {
  if (injected || Platform.OS !== 'web' || typeof document === 'undefined') return;

  const root = document.documentElement;
  const vars = getLlganCssVars(intensity);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.style.setProperty('--llgan-glass-card-alpha', intensity === 'strong' ? '0.1' : '0.12');
  root.style.setProperty('--llgan-glass-panel-alpha', intensity === 'strong' ? '0.16' : '0.14');

  if (document.getElementById(LLGAN_GLASS_SURFACE_STYLE_ID)) {
    injected = true;
    return;
  }

  const tag = document.createElement('style');
  tag.id = LLGAN_GLASS_SURFACE_STYLE_ID;
  tag.textContent = LLGAN_GLASS_SURFACE_CSS;
  document.head.appendChild(tag);
  injected = true;
}
