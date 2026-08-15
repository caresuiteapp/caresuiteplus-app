import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('HealthOS central popup design contract', () => {
  it('disables the former bright ORBIT repaint while a central popup is active', () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toContain('&& !currentRouteIsPopup');
    expect(layout).toContain("document.documentElement.toggleAttribute('data-cs-central-popup', currentRouteIsPopup)");
  });

  it('renders one embedded dark workspace instead of a second legacy modal', () => {
    const shell = read('src/components/layout/ScreenShell.tsx');
    expect(shell).toContain('<SurfaceContrastProvider tone="dark">');
    expect(shell).toContain("csCentralPopupWorkspace: 'true'");
    expect(shell).toContain("csCentralPopupPageHeader: 'true'");
    expect(shell).not.toContain("import { PlatformModal } from './platform/platformmodal'");
    expect(shell).not.toContain('<PlatformModal');
  });

  it('loads the central contract after the historic contracts', () => {
    const html = read('app/+html.tsx');
    expect(html.indexOf('${CENTRAL_HEALTHOS_POPUP_CONTRACT_CSS}')).toBeGreaterThan(
      html.indexOf('${ORBIT_INTERNAL_CONTRACT_CSS}'),
    );
  });

  it('themes every canonical page building block inside the central popup', () => {
    const css = read('src/design/web/centralHealthOSPopupContractCss.ts');
    for (const component of [
      'section', 'table', 'modal', 'card', 'interactive-card', 'kpi-card',
      'module-tile', 'filter-chip', 'tab', 'filter-select', 'list-row', 'input', 'button',
    ]) {
      expect(css).toContain(`data-cs-healthos-component="${component}"`);
    }
    expect(css).toContain('data-cs-central-popup-workspace="true"');
    expect(css).toContain('data-cs-healthos-zone="content"');
  });
});
