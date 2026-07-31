import { useCallback, useRef, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { llganGlassDataSet, type LlganGlassSurfaceKind } from '@/design/tokens/auroraGlass';
import { ensureLightLiquidGlassSurfaceCss } from '@/design/web/ensureLightLiquidGlassSurfaceCss';

type GlassDomPreset = {
  surface: string;
  surfaceEnd: string;
  border: string;
  blur: number;
};

const GLASS_DOM_PRESETS: Record<LlganGlassSurfaceKind, GlassDomPreset> = {
  panel: { surface: 'rgba(15,39,71,.82)', surfaceEnd: 'rgba(7,20,42,.94)', border: 'rgba(105,232,255,.28)', blur: 30 },
  card: { surface: 'rgba(19,48,84,.84)', surfaceEnd: 'rgba(7,20,42,.94)', border: 'rgba(105,232,255,.32)', blur: 26 },
  chip: { surface: 'rgba(105,232,255,.12)', surfaceEnd: 'rgba(255,255,255,.055)', border: 'rgba(105,232,255,.28)', blur: 18 },
  input: { surface: 'rgba(255,255,255,.11)', surfaceEnd: 'rgba(105,232,255,.065)', border: 'rgba(105,232,255,.30)', blur: 18 },
  button: { surface: 'rgba(105,232,255,.15)', surfaceEnd: 'rgba(255,255,255,.07)', border: 'rgba(105,232,255,.38)', blur: 18 },
  modal: { surface: 'rgba(16,42,76,.97)', surfaceEnd: 'rgba(3,14,31,.99)', border: 'rgba(105,232,255,.42)', blur: 42 },
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
  el.style.setProperty('-webkit-backdrop-filter', `blur(${preset.blur}px) saturate(1.28)`, 'important');
  el.style.setProperty('backdrop-filter', `blur(${preset.blur}px) saturate(1.28)`, 'important');
  el.style.setProperty('background-color', preset.surfaceEnd, 'important');
  el.style.setProperty(
    'background-image',
    `radial-gradient(circle at 82% -18%, rgba(105,232,255,.24), transparent 40%), linear-gradient(145deg, ${preset.surface} 0%, ${preset.surfaceEnd} 100%)`,
    'important',
  );
  el.style.setProperty('border', `1px solid ${preset.border}`, 'important');
  el.style.setProperty(
    'box-shadow',
    '0 26px 68px rgba(0,7,22,.48), 0 0 32px rgba(105,232,255,.08), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(105,232,255,.10)',
    'important',
  );
}

type LlganGlassShellProps = {
  kind: LlganGlassSurfaceKind;
  style?: StyleProp<ViewStyle>;
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
