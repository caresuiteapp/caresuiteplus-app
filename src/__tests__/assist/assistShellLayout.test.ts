import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Assist module shell layout', () => {
  it('root assist layout wraps Stack in ShellLayout', () => {
    const layout = readSrc('app/assist/_layout.tsx');
    expect(layout).toContain('ShellLayout');
    expect(layout).toContain('area="assist"');
    expect(layout).toMatch(/<Stack[\s\S]*\/>/);
  });

  it('assist tabs layout does not nest a second ShellLayout', () => {
    const layout = readSrc('app/assist/(tabs)/_layout.tsx');
    expect(layout).not.toContain('ShellLayout');
    expect(layout).toContain('Shell lives in app/assist/_layout.tsx');
  });

  it('German kalender alias redirects to canonical calendar route', () => {
    const route = readSrc('app/assist/kalender.tsx');
    expect(route).toContain('Redirect');
    expect(route).toContain('/assist/calendar');
  });

  it('German touren route renders dedicated Touren screen', () => {
    const route = readSrc('app/assist/touren.tsx');
    expect(route).toContain('AssistTourenScreen');
  });

  it('live-status route renders dedicated Live-Status screen', () => {
    const route = readSrc('app/assist/live-status.tsx');
    expect(route).toContain('AssistLiveStatusScreen');
  });

  it('CareLightPageShell uses flexGrow layout inside PlatformShell aurora host', () => {
    const shell = readSrc('src/components/layout/CareLightPageShell.tsx');
    expect(shell).toContain('flexGrow: 1');
    expect(shell).toContain('styles.contentHost');
    expect(shell).toContain('testID="care-light-page-shell"');
  });

  it('route stack content style stretches to fill shell main area', () => {
    const style = readSrc('src/design/routeLayoutStyle.ts');
    expect(style).toContain('flex: 1');
    expect(style).toContain('flexGrow: 1');
    expect(style).toContain('minHeight: 0');
  });

  it('PlatformShell main content slot stretches for nested route stacks', () => {
    const shell = readSrc('src/components/layout/platform/platformshell.tsx');
    expect(shell).toContain('mainContentStretch');
    expect(shell).toMatch(/mainContentStretch:[\s\S]*flex: 1/);
  });

  it('ScreenShell aurora host uses flex fill for scroll=false pages', () => {
    const shell = readSrc('src/components/layout/ScreenShell.tsx');
    expect(shell).toMatch(/auroraRoot:[\s\S]*flex: 1/);
    expect(shell).toMatch(/contentHost:[\s\S]*flex: 1/);
  });
});
