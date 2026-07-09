import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { llganGlassDataSet, type LlganGlassSurfaceKind } from '@/design/tokens/auroraGlass';
import { ensureLightLiquidGlassSurfaceCss } from '@/design/web/ensureLightLiquidGlassSurfaceCss';

type GlassDomPreset = {
  blurPx: number;
  saturate: number;
  alpha: number;
  border: string;
};

const GLASS_DOM_PRESETS: Record<LlganGlassSurfaceKind, GlassDomPreset> = {
  panel: { blurPx: 52, saturate: 1.72, alpha: 0.12, border: 'rgba(110, 160, 255, 0.3)' },
  card: { blurPx: 48, saturate: 1.65, alpha: 0.14, border: 'rgba(255, 255, 255, 0.82)' },
  chip: { blurPx: 28, saturate: 1.36, alpha: 0.14, border: 'rgba(120, 160, 255, 0.28)' },
  input: { blurPx: 28, saturate: 1.36, alpha: 0.14, border: 'rgba(120, 160, 255, 0.28)' },
  button: { blurPx: 28, saturate: 1.36, alpha: 0.14, border: 'rgba(120, 160, 255, 0.28)' },
  modal: { blurPx: 56, saturate: 1.72, alpha: 0.32, border: 'rgba(255, 255, 255, 0.78)' },
};

const OBSERVER_KEY = '__csLlganGlassObserver';

function isDomElement(node: unknown): node is HTMLElement {
  if (typeof node !== 'object' || node === null) return false;
  const el = node as HTMLElement;
  return typeof el.setAttribute === 'function' && typeof el.classList !== 'undefined' && !!el.style;
}

function resolveGlassElement(node: View | HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  if (isDomElement(node)) return node;
  return null;
}

/** Backup: pin milchglas on DOM when RN rewrites inline backdrop-filter between renders. */
export function bindLlganGlassSurface(node: View | HTMLElement | null, kind: LlganGlassSurfaceKind): void {
  if (Platform.OS !== 'web' || !node) return;

  ensureLightLiquidGlassSurfaceCss('strong');

  const el = resolveGlassElement(node);
  if (!el?.style) return;

  const preset = GLASS_DOM_PRESETS[kind];

  const apply = () => {
    el.setAttribute('data-cs-llgan-glass', kind);
    el.classList.add('cs-llgan-glass', `cs-llgan-glass-${kind}`);

    const blur = `blur(${preset.blurPx}px) saturate(${preset.saturate})`;
    el.style.setProperty('-webkit-backdrop-filter', blur, 'important');
    el.style.setProperty('backdrop-filter', blur, 'important');
    el.style.setProperty('background-color', `rgba(255, 255, 255, ${preset.alpha})`, 'important');
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('border', `1px solid ${preset.border}`, 'important');
    el.style.setProperty(
      'box-shadow',
      '0 20px 56px rgba(70, 110, 170, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.88)',
      'important',
    );
  };

  apply();
  requestAnimationFrame(apply);

  const observerHost = el as HTMLElement & { [OBSERVER_KEY]?: MutationObserver };
  if (!observerHost[OBSERVER_KEY]) {
    const observer = new MutationObserver(() => apply());
    observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    observerHost[OBSERVER_KEY] = observer;
  }
}

type LlganGlassShellProps = {
  kind: LlganGlassSurfaceKind;
  style?: ViewStyle;
  children: ReactNode;
};

/** Web milchglas host — inline RN backdrop-filter + data-cs-llgan-glass CSS backup. */
export function LlganGlassShell({ kind, style, children }: LlganGlassShellProps) {
  const shellRef = useRef<View | null>(null);

  const applyGlass = useCallback(() => {
    bindLlganGlassSurface(shellRef.current, kind);
  }, [kind]);

  const setShellRef = useCallback(
    (node: View | null) => {
      shellRef.current = node;
      bindLlganGlassSurface(node, kind);
    },
    [kind],
  );

  useLayoutEffect(() => {
    applyGlass();
    const id = requestAnimationFrame(applyGlass);
    return () => cancelAnimationFrame(id);
  }, [applyGlass]);

  if (Platform.OS !== 'web') {
    return <View style={style}>{children}</View>;
  }

  return (
    <View ref={setShellRef} {...llganGlassDataSet(kind)} style={style}>
      {children}
    </View>
  );
}
