import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  EMPLOYEE_PORTAL_VISUAL_VIEWPORTS,
  EMPLOYEE_VISIT_VISUAL_STATES,
  isEmployeeVisitExecutionRoute,
  resolveAccessHeaderLogoWidth,
  resolveCompactPortalLogoWidth,
  resolvePortalDesktopChrome,
} from '@/lib/portal/portalResponsiveLayout';
import {
  WORKFLOW_FINALIZE_TIMEOUT_MS,
  WORKFLOW_START_SERVICE_TIMEOUT_MS,
} from '@/features/assistWorkflow/internal/withWorkflowTimeout';
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

  it('gives the live visit its full mobile workspace without a second bottom navigation', () => {
    expect(isEmployeeVisitExecutionRoute('/portal/employee/assignments/visit-1/execute')).toBe(true);
    expect(isEmployeeVisitExecutionRoute('/portal/employee/assignments/visit-1')).toBe(false);
    expect(isEmployeeVisitExecutionRoute('/portal/employee/calendar')).toBe(false);

    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    const tab = read('src/screens/portal/PortalTabScreen.tsx');
    const execution = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');

    expect(shell).toContain('!desktopChrome && !visitExecutionFocus');
    expect(tab).toContain('showBottomTabs && !routeOwnsBottomBar');
    expect(execution).toContain('contentOwnsHero');
    expect(execution.indexOf('<ScrollView')).toBeLessThan(
      execution.indexOf('<EmployeePortalVisitStickyHeader'),
    );
  });

  it('allows vertical page swipes from the wide month calendar', () => {
    const calendar = read('src/components/portal/EmployeePortalCalendarScreen.tsx');
    expect(calendar).toContain("touchAction: 'pan-x pan-y'");
    expect(calendar).not.toContain("touchAction: 'pan-x',");
  });

  it('uses a realistic confirmation budget for proof-backed finalization', () => {
    expect(WORKFLOW_FINALIZE_TIMEOUT_MS).toBe(12_000);
    expect(WORKFLOW_START_SERVICE_TIMEOUT_MS).toBe(12_000);
    const hook = read('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain("timeoutLabel: 'finalizeVisit'");
    expect(hook).toContain('timeoutMs: WORKFLOW_FINALIZE_TIMEOUT_MS');
  });

  it('gives task work the full tablet workspace instead of a narrow desktop column', () => {
    const tasks = read('src/components/portal/EmployeePortalVisitTasksPanel.tsx');
    expect(tasks).toContain('isPhoneClass(deviceClass)');
    expect(tasks).toContain("variant={isPhone ? 'bottomSheet' : 'center'}");
    expect(tasks).toContain('isPhone ? 560 : 920');
    expect(tasks).not.toContain('!isDesktopClass(deviceClass)');
  });

  it('shows a branded boot state and caches immutable production bundles', () => {
    const html = read('app/+html.tsx');
    const layout = read('app/_layout.tsx');
    const vercel = read('vercel.json');
    expect(html).toContain('id="caresuite-web-boot"');
    expect(html).toContain('Die Verbindung dauert ungewöhnlich lange');
    expect(html).toContain('window.location.reload()');
    expect(layout).toContain("document.getElementById('caresuite-web-boot')?.remove()");
    expect(vercel).toContain('max-age=31536000, immutable');
    expect(vercel).toContain('/_expo/static/(.*)');
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

  it('keeps vertical page gestures outside the wide web calendar scroller', () => {
    const calendar = read('src/components/portal/EmployeePortalCalendarScreen.tsx');
    expect(calendar).toContain("needsWideCanvas && Platform.OS === 'web'");
    expect(calendar).toContain("overflowY: 'visible'");
    expect(calendar).toContain("touchAction: 'pan-x pan-y'");
  });

  it('keeps both mobile welcome heroes in intrinsic document flow', () => {
    const employeeHome = read('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    const clientHome = read('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    const page = read('src/components/healthos/HealthOSPage.tsx');
    const appointmentHero = read('src/components/portal/PortalAppointmentDetailHero.tsx');

    expect(employeeHome).toMatch(
      /welcomeCopyCompact:\s*\{[\s\S]*?flexGrow:\s*0,[\s\S]*?flexShrink:\s*0,[\s\S]*?flexBasis:\s*'auto'/,
    );
    expect(employeeHome).toMatch(
      /guideAreaCompact:\s*\{[\s\S]*?flexGrow:\s*0,[\s\S]*?flexShrink:\s*0,[\s\S]*?flexBasis:\s*'auto'/,
    );
    expect(employeeHome).toContain('guideMascotCompact: { width: 52, height: 61');
    expect(employeeHome).toContain("guideBubbleCompact: { flex: 1, minWidth: 0, width: 'auto', alignSelf: 'stretch'");

    for (const styleName of ['welcomeCopyPhone', 'guideAreaPhone', 'guideBubblePhone']) {
      const styleBlock = clientHome.match(
        new RegExp(`${styleName}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`),
      )?.[1];
      expect(styleBlock, `${styleName} must have an intrinsic height`).toBeTruthy();
      expect(styleBlock).toContain('flexGrow: 0');
      expect(styleBlock).toContain('flexShrink: 0');
      expect(styleBlock).toContain("flexBasis: 'auto'");
      expect(styleBlock).not.toMatch(/flex:\s*0/);
    }

    expect(page).toMatch(
      /scrollContent:\s*\{[\s\S]*?flexGrow:\s*0,[\s\S]*?flexShrink:\s*0,[\s\S]*?flexBasis:\s*'auto'/,
    );
    expect(page).not.toMatch(/scrollContent:\s*\{[\s\S]*?flex:\s*0/);
    expect(appointmentHero).toMatch(
      /kpiItemPhone:\s*\{[\s\S]*?flexGrow:\s*0,[\s\S]*?flexShrink:\s*0,[\s\S]*?flexBasis:\s*'auto'/,
    );
    expect(appointmentHero).not.toMatch(/kpiItemPhone:\s*\{[\s\S]*?flex:\s*0/);
  });

  it('keeps every execution modal on one readable portal surface', () => {
    const modal = read('src/components/layout/platform/platformmodal.tsx');
    const header = read('src/components/layout/platform/gradientmodalheader.tsx');
    const documentation = read('src/components/portal/EmployeePortalVisitDocumentationPanel.tsx');
    const tasks = read('src/components/portal/EmployeePortalVisitTasksPanel.tsx');
    const photos = read('src/components/portal/EmployeePortalVisitPhotoModal.tsx');

    expect(modal).toContain('usePortalPremiumRuntimeTheme');
    expect(modal).toContain('portalPremium.surfaceRaised');
    expect(header).toContain('usePortalPremiumRuntimeTheme');
    expect(header).toContain('portalPremium.text.secondary');
    expect(documentation).toContain('employee-visit-documentation-form');
    expect(documentation).not.toContain('subtitle={statusLabel}');
    for (const source of [documentation, tasks, photos]) {
      expect(source).toContain('sheetStyle={styles.modalSheet}');
      expect(source).toContain('bodyStyle={styles.modalBody}');
      expect(source).not.toContain('<ScrollView');
    }
  });

  it('protects large text and dark workflow chrome from clipping and low contrast', () => {
    const button = read('src/components/ui/PremiumButton.tsx');
    const banner = read('src/components/ui/InfoBanner.tsx');
    const detail = read('src/components/detail/DetailInfoRow.tsx');
    const bottomBar = read('src/components/portal/EmployeePortalVisitBottomBar.tsx');
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const summary = read('src/components/portal/EmployeePortalVisitSummaryPanel.tsx');
    const live = read('src/components/portal/EmployeePortalVisitLiveDashboard.tsx');
    const sticky = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    const progress = read('src/components/portal/EmployeePortalVisitProgressSteps.tsx');

    expect(button).toContain('minHeight: height');
    expect(button).not.toMatch(/button:\s*\{\s*height,/);
    expect(banner).toContain('onDarkSurface?: boolean');
    expect(screen).toContain('onDarkSurface />');
    expect(detail).toContain('portal.active ? portalPremium.text.primary : c.text');
    expect(bottomBar).toContain("from '@expo/vector-icons'");
    expect(bottomBar).toContain('employeePortalExecutionSurface.actionBarBackground');
    expect(bottomBar).not.toMatch(/[☑📝📷]/u);
    expect(screen).not.toContain('styles.dismissText');
    expect(summary).toContain('<PremiumCard contentStyle={styles.wrap}>');
    expect(summary).toContain('presentation="inline"');
    expect(live).toContain('timerBlockCompact');
    expect(live).toContain('cardCell: { flex: 1, minWidth: 0');
    expect(sticky).toContain('numberOfLines={compact ? 2 : 1}');
    expect(progress).toContain('numberOfLines={2}');
  });
});
