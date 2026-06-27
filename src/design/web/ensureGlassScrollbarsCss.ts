import { Platform } from 'react-native';
import { GLASS_SCROLLBARS_CSS, GLASS_SCROLLBARS_STYLE_ID } from '@/design/web/glassScrollbarsCss';

let injected = false;

/** Inject glass scrollbar CSS once (web only). Safe to call from multiple components. */
export function ensureGlassScrollbarsCss(): void {
  if (injected || Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(GLASS_SCROLLBARS_STYLE_ID)) {
    injected = true;
    return;
  }
  const tag = document.createElement('style');
  tag.id = GLASS_SCROLLBARS_STYLE_ID;
  tag.textContent = GLASS_SCROLLBARS_CSS;
  document.head.appendChild(tag);
  injected = true;
}
