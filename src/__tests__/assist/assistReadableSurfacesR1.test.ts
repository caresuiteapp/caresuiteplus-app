import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Assist readable surfaces R1', () => {
  it('keeps live-status assignment cards light inside the central popup', () => {
    const source = read('src/screens/assist/AssistLiveStatusScreen.tsx');

    expect(source).toContain('<SurfaceContrastProvider tone="light">');
    expect(source).toContain("csAssistReadableSurface: 'light'");
  });

  it('keeps assignment detail sections and their content on one light contrast context', () => {
    const source = read('src/components/assist/AssignmentDetailTabsPanel.tsx');

    expect(source).toContain('<SurfaceContrastProvider tone="light">');
    expect(source).toContain("csAssistReadableSurface: 'light'");
  });

  it('preserves the shared light surface contract and explicit inverse controls', () => {
    const css = read('src/design/web/centralHealthOSPopupContractCss.ts');

    // Assist shares the marked desktop surface contract; the former
    // Assist-only variables were replaced by that shared implementation.
    expect(css).toContain('html [data-cs-desktop-surface="light"]');
    expect(css).toContain('color: #102B49; background: #FFFFFF !important;');
    expect(css).toContain('color: #526B82 !important; -webkit-text-fill-color: #526B82 !important;');
    expect(css).toContain('outline: 3px solid #1477D6 !important;');
    expect(css).toContain('[data-cs-healthos-surface="dark"] input');
    expect(css).toContain('background-color: #071A31 !important;');
  });
});
