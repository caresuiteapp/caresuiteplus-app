import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { employeePortalLayout } from '@/components/portal/employee/employeePortalDesign';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('portal premium system R26', () => {
  it('provides the same premium design context to client and employee routes', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(shell).toContain('PortalPremiumProvider');
    expect(shell).toContain('<PortalPremiumProvider kind={kind}>');
    expect(shell).toContain("kind === 'client' || kind === 'employee'");
    expect(shell).toContain('PortalTextSizeControls');
  });

  it('uses responsive page headings and bounded workspaces in both portals', () => {
    const client = read('src/components/portal/ClientPortalPageFrame.tsx');
    const employee = read('src/components/portal/EmployeePortalPageFrame.tsx');
    expect(client).toContain('PortalPremiumPageHero');
    expect(client).toContain('maxWidth: 1540');
    expect(client).toContain('HealthOSPageSurface');
    expect(employee).toContain('EmployeePortalPageHeader');
    expect(employee).toContain('maxWidth: 1440');
    expect(employee).toContain('HealthOSPageZone');
    expect(employee).toContain('minHeight: 0');
  });

  it('switches heroes and work cards to a dedicated mobile layout below 760 px', () => {
    const pageHero = read('src/components/portal/PortalPremiumPageHero.tsx');
    const clientHome = read('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    const employeeHome = read('src/components/portal/employee/EmployeePortalToday.tsx');
    const appointment = read('src/components/portal/assist/PortalNextAppointmentHero.tsx');

    expect(pageHero).toContain('isPhone || width < 760');
    expect(clientHome).toContain('isPhone || width < 760');
    expect(employeePortalLayout(390).splitFocus).toBe(false);
    expect(appointment).toContain('isPhone || width < 760');
    expect(clientHome).toContain("compact ? '100%'");
    expect(employeeHome).toContain('layout.splitFocus');
    expect(employeePortalLayout(1440).groupColumns).toBe(3);
  });

  it('keeps employee guidance and opens client guidance on demand', () => {
    const clientHome = read('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    const employeeHome = read('src/components/portal/employee/EmployeePortalToday.tsx');
    expect(clientHome).toContain('<PortalInfoButton');
    expect(read('src/components/portal/PortalInfoButton.tsx')).toContain('visible={open}');
    expect(employeeHome).toContain("require('../../../../public/landingpage/media/neo.png')");
    expect(clientHome).toContain('guideAreaPhone');
    expect(employeeHome).toContain('layout.phone ? 40 : 62');
    expect(clientHome).toContain('overflow: \'hidden\'');
    expect(read('src/screens/portal/PortalTabScreen.tsx')).toContain('employeeHomeViewport');
  });

  it('applies premium surfaces and controls through shared primitives', () => {
    const card = read('src/design/components/GlassCard.tsx');
    const button = read('src/components/ui/PremiumButton.tsx');
    const premiumCard = read('src/components/ui/PremiumCard.tsx');
    const modal = read('src/components/layout/platform/platformmodal.tsx');
    for (const source of [card, button, premiumCard]) {
      expect(source).toContain('usePortalPremiumTheme');
    }
    expect(modal).toContain('usePortalPremiumRuntimeTheme');
    expect(button).toContain('portalPremium.accent.blue');
    expect(modal).toContain('portalTheme.active ||');
  });

  it('keeps employee execution and document work on readable light surfaces', () => {
    const execution = read('src/lib/portal/employeePortalExecutionSurface.ts');
    const live = read('src/components/portal/EmployeePortalVisitLiveDashboard.tsx');
    const signatures = read('src/screens/portal/EmployeeDocumentSignaturesScreen.tsx');
    expect(execution).toContain('portalPremium.surfaceRaised');
    expect(execution).toContain('portalPremium.text');
    expect(live).toContain('employeePortalExecutionSurface.subtleBackground');
    expect(signatures).toContain('portalPremium.surfaceSoft');
  });

  it('preserves the client profile rule without assignments', () => {
    const profile = read('src/screens/portal/ClientPortalProfileScreen.tsx');
    const hero = read('src/components/portal/PortalClientProfileHero.tsx');
    expect(profile).not.toContain('ClientPortalProfileAssignmentsSection');
    expect(hero).not.toContain('nextAppointment');
    expect(hero).not.toContain('Nächster Einsatz');
  });

  it('keeps large text available in both portal shells', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    const accessibility = read('src/design/web/webFontScaleConfig.ts');
    expect(shell).toContain('PortalTextSizeControls');
    expect(accessibility).toContain('1.5');
  });
});
