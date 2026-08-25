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

  it('scopes the central-popup compatibility rule to marked Assist work surfaces', () => {
    const css = read('src/design/web/centralHealthOSPopupContractCss.ts');

    expect(css).toContain('data-cs-assist-readable-surface="light"');
    expect(css).toContain('--assist-readable-ink: #0B213D');
    expect(css).toContain('--assist-readable-muted: #526B83');
    expect(css).toContain('background-image: linear-gradient(145deg, #FFFFFF, #EEF6FC) !important');
  });
});
