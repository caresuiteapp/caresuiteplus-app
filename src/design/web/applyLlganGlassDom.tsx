import { useCallback, useRef, type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { llganGlassDataSet, type LlganGlassSurfaceKind } from '@/design/tokens/auroraGlass';
import { ensureLightLiquidGlassSurfaceCss } from '@/design/web/ensureLightLiquidGlassSurfaceCss';

type GlassDomPreset = {
  alpha: number;
  border: string;
};

const GLASS_DOM_PRESETS: Record<LlganGlassSurfaceKind, GlassDomPreset> = {
  panel: { alpha: 0.88, border: 'rgba(110, 160, 255, 0.3)' },
  card: { alpha: 0.92, border: 'rgba(255, 255, 255, 0.82)' },
  chip: { alpha: 0.9, border: 'rgba(120, 160, 255, 0.28)' },
  input: { alpha: 0.94, border: 'rgba(120, 160, 255, 0.28)' },
  button: { alpha: 0.92, border: 'rgba(120, 160, 255, 0.28)' },
  modal: { alpha: 0.96, border: 'rgba(255, 255, 255, 0.78)' },
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
  el.style.setProperty('background-image', 'none', 'important');
  el.style.setProperty('border', `1px solid ${preset.border}`, 'important');
  el.style.setProperty(
    'box-shadow',
    '0 14px 36px rgba(70, 110, 170, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
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
