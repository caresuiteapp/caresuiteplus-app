import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('portal premium runtime R28', () => {
  it('marks the browser root while either premium portal is mounted', () => {
    const provider = read('src/design/tokens/portalPremium.tsx');
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');

    expect(provider).toContain("root.setAttribute('data-cs-portal-premium', kind)");
    expect(provider).toContain("root.removeAttribute('data-cs-portal-premium')");
    expect(shell).toContain('<PortalPremiumProvider kind={kind}>');
  });

  it('places bright portal HealthOS rules after the generic dark important rules', () => {
    const css = read('src/design/web/healthOSPageContractCss.ts');
    const genericDarkSection = css.indexOf('[data-cs-healthos-component="section"] {');
    const portalSection = css.indexOf(
      'html[data-cs-portal-premium] [data-cs-healthos-component="section"] {',
    );
    const genericDarkModal = css.indexOf('[data-cs-healthos-component="modal"] {');
    const portalModal = css.indexOf(
      'html[data-cs-portal-premium] [data-cs-healthos-component="modal"] {',
    );

    expect(genericDarkSection).toBeGreaterThan(-1);
    expect(portalSection).toBeGreaterThan(genericDarkSection);
    expect(portalModal).toBeGreaterThan(genericDarkModal);
    expect(css).toContain('html[data-cs-portal-premium] [data-cs-healthos-page="surface"] input::placeholder');
    expect(css).toContain('color: #061B35 !important');
  });

  it('wins the final LLGAN cascade on desktop and performance mobile modes', () => {
    const css = read('src/design/web/lightLiquidGlassSurfaceCss.ts');
    const genericPerformance = css.indexOf(
      '.performance-mobile.performance-ios-safari [data-cs-llgan-glass]',
    );
    const finalPortalContract = css.lastIndexOf(
      'html[data-cs-portal-premium] .cs-llgan-glass',
    );

    expect(finalPortalContract).toBeGreaterThan(genericPerformance);
    expect(css.slice(finalPortalContract)).toContain('background-color: #F7FBFF !important');
    expect(css.slice(finalPortalContract)).toContain('backdrop-filter: none !important');
    expect(css.slice(finalPortalContract)).toContain('color: #647D94 !important');
  });

  it('uses opaque overview surfaces for shared messenger, tables, inputs and cards', () => {
    const tokens = read('src/design/tokens/auroraGlass.ts');
    const dom = read('src/design/web/applyLlganGlassDom.tsx');
    const messenger = read('src/components/messaging/MessengerShell.tsx');

    expect(tokens).toContain('export const portalPremiumGlass');
    expect(tokens).toContain('panel: portalPremium.surfaceRaised');
    expect(tokens).toContain('card: portalPremium.surface');
    expect(tokens).toContain('if (isPortal) return portalPremiumGlass');
    expect(tokens).toContain('? portalPremiumGlass');
    expect(dom).toContain("panel: { surface: '#FFFFFF'");
    expect(messenger).toContain('useMessagingGlassSurface(isGlass)');
    expect(messenger).toContain('ink?.primary ?? c.text');
  });

  it('keeps appointment previews bounded, scroll-owned and readable at every width', () => {
    for (const file of [
      'src/components/portal/ClientPortalAssignmentPreviewSheet.tsx',
      'src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx',
    ]) {
      const source = read(file);
      expect(source, file).toContain('PlatformModal');
      expect(source, file).toContain('minWidth={0}');
      expect(source, file).toContain('maxHeightRatio={isPhone ? 0.9 : 0.86}');
      expect(source, file).toContain('animationType="fade"');
      expect(source, file).toContain('portalPremium.text.primary');
      expect(source, file).not.toContain('useWindowDimensions');
    }
  });

  it('repairs the calendar grid and visible legacy appointment detail fallback', () => {
    const month = read('src/components/office/calendar/OfficeCalendarMonthView.tsx');
    const service = read('src/lib/portal/portalAppointmentsLiveService.ts');

    expect(month).toContain("display: 'grid'");
    expect(month).toContain("gridTemplateColumns: 'repeat(7, minmax(0, 1fr))'");
    expect(service).toContain('fetchLivePortalAppointmentsForClient(tenantId, clientId)');
    expect(service).toContain('candidate.id === assignmentId');
    expect(service).toContain('if (fallback) return { ok: true as const, data: fallback }');
  });
});
