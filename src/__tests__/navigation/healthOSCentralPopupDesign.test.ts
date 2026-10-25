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

  it('renders one embedded workspace with readable native and canonical web contrast', () => {
    const shell = read('src/components/layout/ScreenShell.tsx');
    const web = read('src/components/layout/ScreenShell.web.tsx');
    expect(shell).toContain('<SurfaceContrastProvider tone="light">');
    expect(shell).toContain("backgroundColor: '#F2F6FC'");
    expect(shell).toContain("csCentralPopupWorkspace: 'true'");
    expect(shell).toContain('!contentOwnsHeader && <ScreenHeader');
    expect(shell).not.toContain("import { PlatformModal } from './platform/platformmodal'");
    expect(shell).not.toContain('<PlatformModal');
    expect(web).toContain("export { ScreenShell } from './ScreenShell.tsx'");
    expect(shell).toContain("csDesktopSurface: 'light'");
    expect(web).not.toContain('<PlatformModal');
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
    expect(css).toContain('[data-cs-healthos-zone] { min-width: 0; }');
    expect(read('src/components/layout/ScreenShell.tsx')).toContain('<HealthOSPageZone kind="content"');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('outline: 3px solid #1477D6 !important');
  });
});
