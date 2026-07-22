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
  panel: { surface: 'rgba(44,45,76,.78)', surfaceEnd: 'rgba(27,29,55,.90)', border: 'rgba(255,255,255,.16)', blur: 26 },
  card: { surface: 'rgba(252,250,253,.96)', surfaceEnd: 'rgba(221,217,234,.97)', border: 'rgba(255,255,255,.84)', blur: 24 },
  chip: { surface: 'rgba(255,255,255,.10)', surfaceEnd: 'rgba(255,255,255,.055)', border: 'rgba(255,255,255,.20)', blur: 18 },
  input: { surface: 'rgba(255,255,255,.11)', surfaceEnd: 'rgba(255,255,255,.065)', border: 'rgba(255,255,255,.22)', blur: 18 },
  button: { surface: 'rgba(255,255,255,.12)', surfaceEnd: 'rgba(255,255,255,.07)', border: 'rgba(255,255,255,.24)', blur: 18 },
  modal: { surface: 'rgba(250,248,252,.97)', surfaceEnd: 'rgba(216,212,231,.98)', border: 'rgba(255,255,255,.86)', blur: 34 },
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
    `radial-gradient(circle at 72% -12%, rgba(85,221,246,.14), transparent 36%), linear-gradient(145deg, ${preset.surface} 0%, ${preset.surfaceEnd} 100%)`,
    'important',
  );
  el.style.setProperty('border', `1px solid ${preset.border}`, 'important');
  el.style.setProperty(
    'box-shadow',
    kind === 'card' || kind === 'modal'
      ? '0 22px 58px rgba(5,7,22,.20), inset 0 1px 0 rgba(255,255,255,.88), inset 0 -1px 0 rgba(105,232,255,.08)'
      : '0 22px 58px rgba(5,7,22,.34), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(105,232,255,.06)',
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
