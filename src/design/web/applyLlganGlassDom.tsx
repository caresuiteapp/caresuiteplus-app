import { useCallback, useRef, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { llganGlassDataSet, type LlganGlassSurfaceKind } from '@/design/tokens/auroraGlass';
import { ensureLightLiquidGlassSurfaceCss } from '@/design/web/ensureLightLiquidGlassSurfaceCss';
import { usePortalPremiumTheme } from '@/design/tokens/portalPremium';

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

const PORTAL_GLASS_DOM_PRESETS: Record<LlganGlassSurfaceKind, GlassDomPreset> = {
  panel: { surface: '#FFFFFF', surfaceEnd: '#EAF4FF', border: 'rgba(112,181,255,.42)', blur: 0 },
  card: { surface: '#FFFFFF', surfaceEnd: '#EEF7FF', border: 'rgba(112,181,255,.38)', blur: 0 },
  chip: { surface: '#F7FBFF', surfaceEnd: '#EAF4FF', border: 'rgba(5,108,232,.22)', blur: 0 },
  input: { surface: '#FFFFFF', surfaceEnd: '#F2F8FF', border: 'rgba(5,108,232,.28)', blur: 0 },
  button: { surface: '#F7FBFF', surfaceEnd: '#EAF4FF', border: 'rgba(5,108,232,.30)', blur: 0 },
  modal: { surface: '#FFFFFF', surfaceEnd: '#EAF4FF', border: 'rgba(112,181,255,.48)', blur: 0 },
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
export function bindLlganGlassSurface(
  node: View | HTMLElement | null,
  kind: LlganGlassSurfaceKind,
  portalActive = false,
): void {
  if (Platform.OS !== 'web' || !node) return;

  ensureLightLiquidGlassSurfaceCss('strong');

  const el = resolveGlassElement(node);
  if (!el?.style) return;

  const preset = portalActive ? PORTAL_GLASS_DOM_PRESETS[kind] : GLASS_DOM_PRESETS[kind];

  el.setAttribute('data-cs-llgan-glass', kind);
  el.classList.add('cs-llgan-glass', `cs-llgan-glass-${kind}`);
  el.style.setProperty('-webkit-backdrop-filter', `blur(${preset.blur}px) saturate(1.28)`, 'important');
  el.style.setProperty('backdrop-filter', `blur(${preset.blur}px) saturate(1.28)`, 'important');
  el.style.setProperty('background-color', preset.surfaceEnd, 'important');
  el.style.setProperty(
    'background-image',
    portalActive
      ? `radial-gradient(circle at 82% -18%, rgba(112,181,255,.30), transparent 42%), linear-gradient(145deg, ${preset.surface} 0%, ${preset.surfaceEnd} 100%)`
      : `radial-gradient(circle at 82% -18%, rgba(105,232,255,.24), transparent 40%), linear-gradient(145deg, ${preset.surface} 0%, ${preset.surfaceEnd} 100%)`,
    'important',
  );
  el.style.setProperty('border', `1px solid ${preset.border}`, 'important');
  el.style.setProperty(
    'box-shadow',
    portalActive
      ? '0 14px 34px rgba(0,38,82,.16), inset 0 1px 0 rgba(255,255,255,.94), inset 0 -1px 0 rgba(112,181,255,.15)'
      : '0 26px 68px rgba(0,7,22,.48), 0 0 32px rgba(105,232,255,.08), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(105,232,255,.10)',
    'important',
  );
  if (portalActive) {
    el.style.setProperty('color', '#061B35', 'important');
  }
}

type LlganGlassShellProps = {
  kind: LlganGlassSurfaceKind;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Web milchglas host — inline RN backdrop-filter + data-cs-llgan-glass CSS backup. */
export function LlganGlassShell({ kind, style, children }: LlganGlassShellProps) {
  const shellRef = useRef<View | null>(null);
  const portal = usePortalPremiumTheme();

  const setShellRef = useCallback(
    (node: View | null) => {
      shellRef.current = node;
      bindLlganGlassSurface(node, kind, portal.active);
    },
    [kind, portal.active],
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
