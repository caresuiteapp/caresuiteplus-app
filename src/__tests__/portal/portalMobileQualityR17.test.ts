import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('R17 native mobile quality gate', () => {
  it('reserves the complete floating-nav area outside route content', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    const tabs = read('src/lib/navigation/portalMobileTabs.ts');
    expect(shell).toContain('compactContentBottomReserve');
    expect(shell).toContain('marginBottom: compactContentBottomReserve');
    expect(tabs).toContain('PORTAL_MOBILE_NAV_HEIGHT = 76');
  });

  it('keeps modal actions above the safe area and full-width on phones', () => {
    const modal = read('src/components/layout/platform/platformmodal.tsx');
    const action = read('src/components/layout/platform/gradientmodalactionbutton.tsx');
    expect(modal).toContain('useSafeAreaInsets');
    expect(modal).toContain('Math.max(insets.bottom + careSpacing.sm, careSpacing.lg)');
    expect(modal).toContain('fullWidth={compact}');
    expect(action).toContain("width: '100%'");
  });

  it('uses the HealthOS identity in the welcome view and removes the legacy robot wordmark', () => {
    const welcome = read('src/components/auth/PortalWelcomeModal.tsx');
    expect(welcome).toContain('<Text style={styles.brand}>CareSuite HealthOS</Text>');
    expect(welcome).not.toContain('CareSuiteWordmark');
    expect(welcome).not.toContain('minHeight: 430');
  });

  it('does not index optional tracking warnings before validating the array', () => {
    const execution = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(execution).toContain('Array.isArray(tracking?.warnings)');
    expect(execution).not.toContain('if (tracking?.warnings[0])');
  });

  it('ships an ASCII-only review-data repair using PostgreSQL Unicode literals', () => {
    const migration = read(
      'supabase/migrations/20260831120000_google_play_review_utf8_repair_r17.sql',
    );
    expect(migration).toContain("U&'CareSuite Pr\\00FCfzentrum Berlin'");
    expect(migration).toContain("U&'Dienstplan und R\\00FCckfrage'");
    expect(migration).toContain("U&'Parkgeb\\00FChr w\\00E4hrend des Betreuungseinsatzes'");
    expect([...migration].every((character) => character.charCodeAt(0) < 128)).toBe(true);
  });

  it('uses phone-native page framing and payroll action stacks', () => {
    const employeeFrame = read('src/components/portal/EmployeePortalPageFrame.tsx');
    const clientFrame = read('src/components/portal/ClientPortalPageFrame.tsx');
    const payroll = read('src/screens/portal/EmployeePayrollMonthScreen.tsx');
    expect(employeeFrame).toContain('padded={!isPhone}');
    expect(clientFrame).toContain('padded={!isPhone}');
    expect(payroll).toContain('styles.actionsPhone');
    expect(payroll).toContain('fullWidth={isPhone}');
  });

  it('removes desktop panel nesting and heavy card depth from phone portals', () => {
    const section = read('src/components/ui/SectionPanel.tsx');
    const card = read('src/components/ui/PremiumCard.tsx');
    const calendar = read('src/components/portal/EmployeePortalCalendarScreen.tsx');
    expect(section).toContain('nativePortalSection = portal.active && isPhone');
    expect(section).toContain('effectiveOpenSurface');
    expect(card).toContain('portal.active && isPhone ? 14 : 20');
    expect(calendar).toContain('styles.wrapPhone');
  });
});
