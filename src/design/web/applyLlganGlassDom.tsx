import { useCallback, useRef, type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { llganGlassDataSet, type LlganGlassSurfaceKind } from '@/design/tokens/auroraGlass';
import { ensureLightLiquidGlassSurfaceCss } from '@/design/web/ensureLightLiquidGlassSurfaceCss';

type GlassDomPreset = {
  alpha: number;
  border: string;
};

const GLASS_DOM_PRESETS: Record<LlganGlassSurfaceKind, GlassDomPreset> = {
  panel: { alpha: 0.64, border: 'rgba(110, 160, 255, 0.34)' },
  card: { alpha: 0.72, border: 'rgba(255, 255, 255, 0.9)' },
  chip: { alpha: 0.7, border: 'rgba(120, 160, 255, 0.3)' },
  input: { alpha: 0.78, border: 'rgba(120, 160, 255, 0.3)' },
  button: { alpha: 0.74, border: 'rgba(120, 160, 255, 0.3)' },
  modal: { alpha: 0.86, border: 'rgba(255, 255, 255, 0.86)' },
};

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

/** Apply the production-safe glass appearance once without observer feedback loops. */
export function bindLlganGlassSurface(node: View | HTMLElement | null, kind: LlganGlassSurfaceKind): void {
  if (Platform.OS !== 'web' || !node) return;

  ensureLightLiquidGlassSurfaceCss('strong');

  const el = resolveGlassElement(node);
  if (!el?.style) return;

  const preset = GLASS_DOM_PRESETS[kind];

  el.setAttribute('data-cs-llgan-glass', kind);
  el.classList.add('cs-llgan-glass', `cs-llgan-glass-${kind}`);
  el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
  el.style.setProperty('backdrop-filter', 'none', 'important');
  el.style.setProperty('background-color', `rgba(255, 255, 255, ${preset.alpha})`, 'important');
  el.style.setProperty(
    'background-image',
    `linear-gradient(145deg, rgba(255,255,255,${Math.min(0.96, preset.alpha + 0.18)}) 0%, rgba(247,251,255,${preset.alpha}) 48%, rgba(235,244,255,${Math.max(0.42, preset.alpha - 0.16)}) 100%)`,
    'important',
  );
  el.style.setProperty('border', `1px solid ${preset.border}`, 'important');
  el.style.setProperty(
    'box-shadow',
    '0 18px 46px rgba(70, 110, 170, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.96), inset 0 -1px 0 rgba(120, 170, 235, 0.1)',
    'important',
  );
}

type LlganGlassShellProps = {
  kind: LlganGlassSurfaceKind;
  style?: ViewStyle;
  children: ReactNode;
};

/** Web milchglas host — inline RN backdrop-filter + data-cs-llgan-glass CSS backup. */
export function LlganGlassShell({ kind, style, children }: LlganGlassShellProps) {
  const shellRef = useRef<View | null>(null);

  const setShellRef = useCallback(
    (node: View | null) => {
      shellRef.current = node;
      bindLlganGlassSurface(node, kind);
    },
    [kind],
  );

  if (Platform.OS !== 'web') {
    return <View style={style}>{children}</View>;
  }

  return (
    <View ref={setShellRef} {...llganGlassDataSet(kind)} style={style}>
      {children}
    </View>
  );
}
