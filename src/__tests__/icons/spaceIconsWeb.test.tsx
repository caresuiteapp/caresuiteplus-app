// @vitest-environment happy-dom
import React, { type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MainModuleKey } from '@/types/navigation/platform';

type Frame = 'card' | 'rail';
type ShellProps = { size: number; active: boolean; frame: Frame; accentColor: string; children: ReactNode };
type GlyphProps = { kind: string; size: number; accent: string; minimal: boolean };
type ModuleProps = { moduleKey: MainModuleKey; size: number; accent: string };
const dependencies: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': await import('react/jsx-runtime'),
  './SpaceIconShell': { SpaceIconShell: ({ size, active, frame, accentColor, children }: ShellProps) =>
    <div data-shell-size={size} data-active={active} data-frame={frame} data-accent={accentColor}>{children}</div> },
  './spaceGlyphs': { SpaceGlyph: ({ kind, size, accent, minimal }: GlyphProps) =>
    <i data-glyph={kind} data-drawing-size={size} data-accent={accent} data-minimal={minimal} /> },
  './spaceModuleRailGlyphs': { ModuleRailGlyph: ({ moduleKey, size, accent }: ModuleProps) =>
    <i data-module-rail={moduleKey} data-drawing-size={size} data-accent={accent} /> },
  // Registry behavior has its own coverage; here it supplies a known glyph so
  // the actual Web entry points and complete drawing stage remain under test.
  './spaceIconRegistry': { resolveSpaceGlyph: (icon?: string) => icon ?? 'orbit' },
};
const boundaryFiles = new Map([
  ['SpaceIconShell.tsx', './SpaceIconShell'],
  ['spaceGlyphs.tsx', './spaceGlyphs'],
  ['spaceModuleRailGlyphs.tsx', './spaceModuleRailGlyphs'],
  ['spaceIconRegistry.ts', './spaceIconRegistry'],
].map(([file, key]) => [resolve('src/components/icons/space', file), key]));
const bundle = buildSync({
  stdin: {
    contents: `
      export { SpaceKpiIcon, SpaceBellIcon, SpaceMandantIcon } from './src/components/icons/space/SpaceKpiIcon.web.tsx';
      export { SpaceModuleIcon } from './src/components/icons/space/SpaceModuleIcon.web.tsx';
    `,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: [...Object.keys(dependencies), ...boundaryFiles.keys()],
}).outputFiles[0].text;
type KpiProps = { icon?: string; accentColor: string; size?: number; active?: boolean; frame?: Frame };
type ModuleIconProps = Omit<KpiProps, 'icon'> & { moduleKey: MainModuleKey };
const loaded = { exports: {} as {
  SpaceKpiIcon: ComponentType<KpiProps>;
  SpaceBellIcon: ComponentType<Omit<KpiProps, 'icon'>>;
  SpaceMandantIcon: ComponentType<Omit<KpiProps, 'icon' | 'frame'>>;
  SpaceModuleIcon: ComponentType<ModuleIconProps>;
} };
new Function('require', 'module', 'exports', bundle)((id: string) => {
  const key = id in dependencies ? id : boundaryFiles.get(resolve(id));
  if (!key) throw new Error(`Unexpected Space icon dependency: ${id}`);
  return dependencies[key];
}, loaded, loaded.exports);
const { SpaceKpiIcon, SpaceModuleIcon, SpaceBellIcon, SpaceMandantIcon } = loaded.exports;
const render = (element: ReactNode) => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(element);
  return host;
};

describe('explicit Web Space icon entry points', () => {
  it('scales a complete invoice drawing while preserving its frame, active state and tint', () => {
    const host = render(<SpaceKpiIcon icon="invoice" accentColor="#0872ce" size={24} active frame="rail" />);
    const shell = host.querySelector('[data-shell-size]')!;
    const stage = host.querySelector<HTMLElement>('[data-space-glyph-stage]')!;
    const motif = host.querySelector('[data-glyph]')!;
    expect(shell.getAttribute('data-shell-size')).toBe('24');
    expect(shell.getAttribute('data-frame')).toBe('rail');
    expect(shell.getAttribute('data-active')).toBe('true');
    expect(shell.getAttribute('data-accent')).toBe('#0872ce');
    expect(stage.getAttribute('data-space-glyph-stage')).toBe('invoice');
    expect(stage.getAttribute('aria-hidden')).toBe('true');
    expect(stage.style.width).toBe('40px');
    expect(stage.style.height).toBe('40px');
    expect(stage.style.flexShrink).toBe('0');
    expect(stage.style.pointerEvents).toBe('none');
    expect(stage.style.transform).toBe(`scale(${24 * 0.86 / 40})`);
    expect((stage.firstElementChild as HTMLElement).style.transform).toBe('translate(-4px, -3px)');
    expect(motif.getAttribute('data-drawing-size')).toBe('40');
    expect(motif.getAttribute('data-minimal')).toBe('true');
    expect(motif.getAttribute('data-accent')).toBe('#0872ce');
  });

  it.each([
    ['zentrale', 'homeOrbit'], ['office', 'office'], ['assist', 'assignmentRoute'], ['pflege', 'medical'],
    ['stationaer', 'ward'], ['beratung', 'messageWave'], ['akademie', 'scholar'], ['admin', 'gear'],
  ] as const)('retains the %s module motif in the card and module rail', (moduleKey, glyph) => {
    const card = render(<SpaceModuleIcon moduleKey={moduleKey} accentColor="#0872ce" size={32} active />);
    expect(card.querySelector('[data-glyph]')!.getAttribute('data-glyph')).toBe(glyph);
    expect(card.querySelector('[data-drawing-size]')!.getAttribute('data-drawing-size')).toBe('40');
    expect(card.querySelector('[data-shell-size]')!.getAttribute('data-shell-size')).toBe('32');
    expect(card.querySelector('[data-active]')!.getAttribute('data-active')).toBe('true');
    const rail = render(<SpaceModuleIcon moduleKey={moduleKey} accentColor="#0872ce" size={24} frame="rail" />);
    expect(rail.querySelector('[data-module-rail]')!.getAttribute('data-module-rail')).toBe(moduleKey);
    expect(rail.querySelector('[data-drawing-size]')!.getAttribute('data-drawing-size')).toBe('40');
    expect(rail.querySelector('[data-space-glyph-stage]')!.getAttribute('data-space-glyph-stage')).toBe('module-rail');
  });

  it('keeps bell and tenant convenience icons on the normalized Web rendering path', () => {
    const host = render(<><SpaceBellIcon accentColor="#0872ce" /><SpaceMandantIcon accentColor="#0872ce" /></>);
    expect([...host.querySelectorAll('[data-glyph]')].map(node => node.getAttribute('data-glyph'))).toEqual(['bell', 'mandant']);
    expect([...host.querySelectorAll('[data-shell-size]')].map(node => node.getAttribute('data-shell-size'))).toEqual(['28', '28']);
    expect(host.querySelectorAll('[data-space-glyph-stage]')).toHaveLength(2);
  });
});
