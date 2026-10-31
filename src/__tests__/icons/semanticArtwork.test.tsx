import React, { type CSSProperties, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { TextProps, TextStyle } from 'react-native';
import type { SemanticArtworkProps } from '@/components/icons/semanticArtwork.types';
import { resolveSemanticArtwork } from '@/components/icons/semanticArtworkModel.web';

const NativeText = ({ children }: TextProps) => <span data-native-text="true">{children}</span>;
const flattenTextStyle = (value: unknown): TextStyle | undefined => {
  if (Array.isArray(value)) return Object.assign({}, ...value.map(flattenTextStyle));
  return value && typeof value === 'object' ? value as TextStyle : undefined;
};
const DesktopArtworkBoundary = ({ route, size }: { route: string; size: number }) =>
  <span data-artwork-route={route} data-artwork-size={size} />;
const SpaceArtworkBoundary = ({ icon }: { icon: string }) => <span data-space-artwork={icon} />;
const spaceArtworkPath = resolve('src/components/icons/space/SpaceKpiIcon.web.tsx');

// Load the real platform implementations and real vector renderer. React Native
// Text/StyleSheet and the separate bitmap/Space artwork renderers are boundaries;
// these assertions cover rendering contracts, not browser layout or PNG quality.
const dependencies: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': { Text: NativeText, View: 'div', StyleSheet: { flatten: flattenTextStyle, create: (value: unknown) => value } },
  '@/liquid-command/components/DesktopCatalogArtwork.web': { DesktopCatalogArtwork: DesktopArtworkBoundary },
  [spaceArtworkPath]: { SpaceKpiIcon: SpaceArtworkBoundary },
};
type ArtworkComponent = (props: SemanticArtworkProps) => ReactElement<Record<string, unknown>>;
function loadModule<Exports>(entryPoint: string): Exports {
  const bundle = buildSync({
    entryPoints: [entryPoint], bundle: true, write: false, platform: 'node',
    format: 'cjs', jsx: 'automatic', external: Object.keys(dependencies),
  }).outputFiles[0].text;
  const loaded = { exports: {} as Exports };
  new Function('require', 'module', 'exports', bundle)((id: string) => {
    // esbuild can print an external file relative to its working directory.
    if (id.startsWith('.') && resolve(id) in dependencies) return dependencies[resolve(id)];
    if (!(id in dependencies)) throw new Error('Unexpected semantic-artwork dependency: ' + id);
    return dependencies[id];
  }, loaded, loaded.exports);
  return loaded.exports;
}
// Extensionless loading would pick the native component and miss Web regressions.
const { SemanticArtwork: NativeArtwork } = loadModule<{ SemanticArtwork: ArtworkComponent }>('src/components/icons/SemanticArtwork.tsx');
const { SemanticArtwork: WebArtwork } = loadModule<{ SemanticArtwork: ArtworkComponent }>('src/components/icons/SemanticArtwork.web.tsx');
const { SPACE_GLYPH_KINDS } = loadModule<{ SPACE_GLYPH_KINDS: readonly string[] }>('src/components/icons/space/spaceIconRegistry.ts');

describe('Semantic artwork keeps the meaning of registered decorative symbols', () => {
  it.each([
    ['🚇', 'transit'], ['🚲', 'bicycle'], ['🛴', 'scooter'], ['🚶', 'walk'],
    ['⚠️', 'warning'], ['✅', 'check'], ['⛔', 'stop'], ['ℹ️', 'info'],
    ['🩺', 'stethoscope'], ['🏥', 'medical'], ['💊', 'medication'],
    ['🩹', 'bandage'], ['❤️', 'heart'], ['💓', 'pulse'], ['🛏️', 'bed'],
  ])('preserves the specific motif for %s', (symbol, vector) => {
    expect(resolveSemanticArtwork(symbol)).toEqual({ vector });
  });

  it('resolves explicit app symbols to their relevant artwork', () => {
    expect(resolveSemanticArtwork('🚗')).toEqual({ route: '/business/office/fahrtenbuch' });
    expect(resolveSemanticArtwork('📄')).toEqual({ route: '/business/office/documents' });
    expect(resolveSemanticArtwork('📅')).toEqual({ route: '/assist/kalender' });
  });

  it.each(['⚠', '❤', '🗓', '⚙'])('normalizes presentation selectors without changing %s', symbol => {
    const expected = resolveSemanticArtwork(symbol);
    expect(expected).not.toBeNull();
    expect(resolveSemanticArtwork(` ${symbol}\uFE0F `)).toEqual(expected);
    expect(resolveSemanticArtwork(`${symbol}\uFE0E`)).toEqual(expected);
  });

  it('does not guess artwork from arbitrary text or React content', () => {
    for (const value of ['', 'Unbekannt', 'Bitte 💊 nicht vergessen', '⚠️ Rückruf',
      12, true, null, undefined, {}, ['🩺'], <strong key="clinical">🩺</strong>]) {
      expect(resolveSemanticArtwork(value)).toBeNull();
    }
  });
});

describe('Semantic artwork preserves native Text compatibility', () => {
  it('forwards children, styles, accessibility and callbacks unchanged, omitting only Web props', () => {
    const children = <><strong>💊</strong> Bitte prüfen</>;
    const style: TextProps['style'] = [{ color: '#203040', fontSize: 27 }, false, { marginRight: 6 }];
    const onPress = vi.fn<NonNullable<TextProps['onPress']>>();
    const onLongPress = vi.fn<NonNullable<TextProps['onLongPress']>>();
    const textProps: TextProps = {
      children, style, onPress, onLongPress, selectable: true, numberOfLines: 2,
      accessibilityLabel: 'Medikation prüfen', accessible: true, testID: 'clinical', nativeID: 'clinical-native',
    };
    const element = NativeArtwork({ ...textProps, webSize: 64, webColor: '#ff0000' });
    expect(element.type).toBe(NativeText);
    expect(element.props).toEqual(textProps);
    expect(element.props.children).toBe(children);
    expect(element.props.style).toBe(style);
    expect(element.props.onPress).toBe(onPress);
    expect(element.props.onLongPress).toBe(onLongPress);
    expect(element.props).not.toHaveProperty('webSize');
    expect(element.props).not.toHaveProperty('webColor');
  });

  it.each(['📄', '⚠️', '🩺'])('keeps %s as native Text even when Web has a registered motif', symbol => {
    const element = NativeArtwork({ children: symbol });
    expect(element.type).toBe(NativeText);
    expect(element.props.children).toBe(symbol);
  });
});

describe('Semantic artwork Web rendering', () => {
  it('renders a registered vector decoratively at the requested size and preserves the surrounding text', () => {
    const element = WebArtwork({ children: '🩺', webSize: 24, testID: 'exam', nativeID: 'exam-native' });
    expect(element.type).toBe('span');
    expect(element.props['aria-hidden']).toBe('true');
    expect(element.props['data-testid']).toBe('exam');
    expect(element.props.id).toBe('exam-native');
    expect(element.props.style).toMatchObject({ width: 24, height: 24, color: '#1676c8', pointerEvents: 'none' });
    const markup = renderToStaticMarkup(<button>{element}<span>Untersuchung starten</span></button>);
    expect(markup).toContain('data-cs-icon="action"');
    expect(markup).toContain('width="24" height="24" viewBox="0 0 24 24"');
    expect(markup).toContain('focusable="false"');
    expect(markup).toContain('<span>Untersuchung starten</span>');
    expect(markup).not.toContain('🩺');
  });

  it('passes route artwork its explicit size without giving the decorative image a second label', () => {
    const element = WebArtwork({ children: '📄', webSize: 48 });
    const child = element.props.children as ReactElement<Record<string, unknown>>;
    expect(child.type).toBe(DesktopArtworkBoundary);
    expect(child.props).toMatchObject({ route: '/business/office/documents', size: 48, label: '' });
    expect(element.props['aria-hidden']).toBe('true');
    expect(renderToStaticMarkup(element)).toContain('data-artwork-route="/business/office/documents"');
  });

  it('preserves each registered Space motif that has no dedicated app or vector artwork', () => {
    const kinds = SPACE_GLYPH_KINDS.filter(kind => !resolveSemanticArtwork(kind));
    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) {
      const element = WebArtwork({ children: kind, webSize: 28, webColor: '#24589d' });
      const child = element.props.children as ReactElement<Record<string, unknown>>;
      expect(child.type).toBe(SpaceArtworkBoundary);
      expect(child.props).toMatchObject({ icon: kind, size: 28, accentColor: '#24589d', frame: 'rail' });
      expect(element.props['aria-hidden']).toBe('true');
    }
  });

  it('supplies a concrete fallback tint for registered Space artwork using an inherited text color', () => {
    const element = WebArtwork({ children: 'qmShield', webColor: 'currentColor' });
    const child = element.props.children as ReactElement<Record<string, unknown>>;
    expect(child.type).toBe(SpaceArtworkBoundary);
    expect(child.props).toMatchObject({ icon: 'qmShield', accentColor: '#1676c8' });
    expect((element.props.style as CSSProperties).color).toBe('currentColor');
  });

  it.each([undefined, 0, -8, NaN, Infinity])('uses a safe default for an unusable size (%s)', webSize => {
    const element = WebArtwork({ children: '⚠️', webSize });
    expect(element.props.style).toMatchObject({ width: 40, height: 40, '--cs-action-icon-size': '40px' });
    expect(renderToStaticMarkup(element)).toContain('width="40" height="40"');
  });

  it('preserves flattened slot layout and active colors while discarding text font metrics', () => {
    const style: TextProps['style'] = [
      { color: '#243d54', fontSize: 99, lineHeight: 120, fontWeight: '700', marginHorizontal: 7 },
      false, { marginVertical: 3, opacity: 0.65 },
    ];
    const element = WebArtwork({ children: '⚠️', webSize: 20, style });
    expect(element.props.style).toMatchObject({
      color: '#243d54', width: 20, height: 20, marginLeft: 7, marginRight: 7,
      marginTop: 3, marginBottom: 3, opacity: 0.65,
    });
    expect(element.props.style).not.toHaveProperty('fontSize');
    expect(element.props.style).not.toHaveProperty('lineHeight');
    expect(element.props.style).not.toHaveProperty('fontWeight');
    const tinted = WebArtwork({ children: '⚠️', style, webColor: '#ffcc00' });
    expect((tinted.props.style as CSSProperties).color).toBe('#ffcc00');
  });

  it('does not mutate shared native style values when applying a Web-only tint', () => {
    const style = Object.freeze({ color: '#ffffff', fontSize: 19 });
    const element = WebArtwork({ children: '×', webSize: 20, webColor: '#124e91', style });
    expect((element.props.style as CSSProperties).color).toBe('#124e91');
    expect(style).toEqual({ color: '#ffffff', fontSize: 19 });
  });

  it('returns unknown text and nested content through Text with their original props and handlers', () => {
    const onPress = vi.fn<NonNullable<TextProps['onPress']>>();
    const style = { color: '#334455', fontSize: 18 };
    for (const children of ['Bitte 💊 nicht vergessen', 'future-custom-glyph', 0,
      ['Unverändert', ' lesen'], <strong key="note">⚠️ Rückruf</strong>]) {
      const textProps: TextProps = { children, onPress, style, accessibilityLabel: 'Notiz', testID: 'note' };
      const element = WebArtwork({ ...textProps, webSize: 20, webColor: '#ff0000' });
      expect(element.type).toBe(NativeText);
      expect(element.props).toEqual(textProps);
      expect(element.props.children).toBe(children);
      expect(element.props.style).toBe(style);
      expect(element.props.onPress).toBe(onPress);
      expect(element.props).not.toHaveProperty('aria-hidden');
      expect(renderToStaticMarkup(element)).not.toContain('data-semantic-artwork');
    }
  });
});
