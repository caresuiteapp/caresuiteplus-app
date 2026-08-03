import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  EMPLOYEE_PORTAL_VISUAL_VIEWPORTS,
  EMPLOYEE_VISIT_VISUAL_STATES,
  resolveAccessHeaderLogoWidth,
  resolveCompactPortalLogoWidth,
  resolvePortalDesktopChrome,
} from '@/lib/portal/portalResponsiveLayout';
import { resolvePlatformModalMaxHeight } from '@/lib/platform/platformModalLayout';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { portalPremium } from '@/design/tokens/portalPremium';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((value) => parseInt(value, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe('employee portal responsive visual gate', () => {
  it('covers phone, tablet portrait/landscape and desktop', () => {
    expect(EMPLOYEE_PORTAL_VISUAL_VIEWPORTS.map(({ id }) => id)).toEqual([
      'mobile-small',
      'mobile-standard',
      'tablet-portrait',
      'tablet-landscape',
      'desktop',
    ]);
    expect(resolvePortalDesktopChrome(390)).toBe(false);
    expect(resolvePortalDesktopChrome(768)).toBe(false);
    expect(resolvePortalDesktopChrome(1023)).toBe(false);
    expect(resolvePortalDesktopChrome(1024)).toBe(true);
    expect(resolvePortalDesktopChrome(1440)).toBe(true);
  });

  it('keeps the compact wordmark clear of all top-bar actions', () => {
    expect(resolveCompactPortalLogoWidth(320)).toBe(130);
    expect(resolveCompactPortalLogoWidth(390)).toBe(190);
    expect(resolveCompactPortalLogoWidth(768)).toBe(224);
    for (const width of [320, 390, 430, 768]) {
      expect(resolveCompactPortalLogoWidth(width)).toBeLessThanOrEqual(width - 190);
    }
  });

  it('keeps the access wordmark and back action inside narrow phones', () => {
    expect(resolveAccessHeaderLogoWidth(320)).toBe(180);
    expect(resolveAccessHeaderLogoWidth(390)).toBe(224);
    expect(resolveAccessHeaderLogoWidth(768)).toBe(320);
    for (const width of [320, 360, 390, 430]) {
      expect(resolveAccessHeaderLogoWidth(width)).toBeLessThanOrEqual(width - 140);
    }
    expect(read('src/liquid-command/screens/AccessScreens.tsx')).toContain(
      '<LiquidLogo width={resolveAccessHeaderLogoWidth(layout.width)} />',
    );
    const primitives = read('src/liquid-command/components/LiquidPrimitives.tsx');
    expect(primitives).toMatch(/status:\s*\{[\s\S]*flexWrap: 'wrap'[\s\S]*maxWidth: '100%'/);
    expect(primitives).toMatch(/statusDetail:\s*\{[\s\S]*flexShrink: 1/);
  });

  it('pairs light execution cards with dark readable text', () => {
    expect(employeePortalExecutionSurface.background).toBe(portalPremium.surfaceRaised);
    expect(employeePortalExecutionSurface.subtleBackground).toBe(portalPremium.surfaceSoft);
    expect(employeePortalExecutionText.primary).toBe(portalPremium.text.primary);
    expect(employeePortalExecutionText.secondary).toBe(portalPremium.text.secondary);
  });

  it('keeps all light portal text combinations at WCAG AA contrast', () => {
    for (const foreground of [
      portalPremium.text.primary,
      portalPremium.text.secondary,
      portalPremium.text.muted,
    ]) {
      for (const background of [
        portalPremium.surfaceRaised,
        portalPremium.surface,
        portalPremium.surfaceSoft,
        portalPremium.surfaceMuted,
      ]) {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('removes legacy dark surfaces from every portal component', () => {
    for (const file of [
      'src/components/portal/AdaptivePortalOverview.tsx',
      'src/components/portal/EmployeePortalClientDocumentPreviewSheet.tsx',
      'src/components/portal/EmployeePortalClientRecordContactActions.tsx',
    ]) {
      const source = read(file);
      expect(source).toContain('portalPremium');
      expect(source).not.toContain('careLightColors');
    }
  });

  it('honors tall workflow bottom sheets on phone and tablet', () => {
    expect(resolvePlatformModalMaxHeight(844, 'bottomSheet', 0.9)).toBeCloseTo(759.6);
    expect(resolvePlatformModalMaxHeight(1024, 'bottomSheet', 0.92)).toBeCloseTo(942.08);
    expect(resolvePlatformModalMaxHeight(768, 'bottomSheet', 1)).toBeCloseTo(721.92);
  });

  it('sizes proof previews from the current viewport instead of a fixed mobile height', () => {
    const signatures = read('src/components/portal/PortalSignatureCapturePanel.tsx');
    expect(signatures).toContain('const previewHeight = Math.max(');
    expect(signatures).toContain('viewportWidth < 720 ? 0.46 : 0.56');
    expect(signatures).toContain('height: previewHeight');
    expect(signatures).not.toContain('minHeight: 480');
  });

  it('registers every visual assignment state through terminal outcomes', () => {
    expect(EMPLOYEE_VISIT_VISUAL_STATES).toEqual([
      'preview',
      'en_route',
      'arrived',
      'live',
      'paused',
      'post_service',
      'documentation',
      'signature',
      'completed',
      'no_show',
      'locked',
    ]);

    const resolver = read('src/lib/portal/resolveVisitExecutionPhase.ts');
    for (const phase of ['preview', 'en_route', 'arrived', 'live', 'post_service', 'completed', 'no_show', 'locked']) {
      expect(resolver).toContain(`'${phase}'`);
    }
    expect(resolver).toContain("effectiveStatus === 'pausiert'");
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('documentationSubmitted');
    expect(screen).toContain('signatureCaptured');
  });

  it('prevents the reported double card, horizontal clipping and blank shell reserve', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    const tab = read('src/screens/portal/PortalTabScreen.tsx');
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const card = read('src/components/ui/PremiumCard.tsx');

    expect(shell).not.toContain('marginBottom: 84');
    expect(shell).not.toContain('84 + insets.bottom');
    expect(tab).toContain("overflowX: 'hidden'");
    expect(tab).toContain("touchAction: 'pan-y'");
    expect(card).toContain('contentStyle?: StyleProp<ViewStyle>');
    expect(card).toContain("dataSet={{ csHealthosComponent: onPress ? 'interactive-card' : 'card' }}");
    expect(screen).toContain('contentStyle={styles.phaseCardContent}');
    expect(screen).not.toContain('style={styles.phaseCard}');
  });

  it('keeps the mobile welcome guide in a bounded row', () => {
    const home = read('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    expect(home).toContain("guideAreaCompact: {\n    flex: 0, minWidth: 0, maxWidth: '100%', width: '100%',\n    flexDirection: 'row'");
    expect(home).toContain('guideMascotCompact: { width: 52, height: 61');
    expect(home).toContain("guideBubbleCompact: { flex: 1, minWidth: 0, width: 'auto'");
  });
});
