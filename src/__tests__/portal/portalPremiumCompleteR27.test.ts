import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('portal premium complete R27', () => {
  it('prevents duplicate page heroes in both portal page frames', () => {
    const screen = read('src/screens/portal/PortalTabScreen.tsx');
    const c14 = read('src/components/layout/C14vSubpageShell.tsx');
    expect(screen).toContain('contentOwnsHero?: boolean');
    expect(screen).toContain('contentOwnsHero ?? hideHeaderOnPhone');
    expect(screen).toContain('showHero={!isPortalHome && !contentProvidesHero}');
    expect(c14).toContain('contentOwnsHero={contentOwnsHero}');
  });

  it('bridges every legacy portal component to the light premium palette', () => {
    const theme = read('src/design/tokens/themeBridge.ts');
    const domGlass = read('src/design/web/applyLlganGlassDom.tsx');
    expect(theme).toContain('usePortalPremiumTheme');
    expect(theme).toContain("portal.active || isInternalOrbitRoute ? 'light' : themeMode");
    expect(theme).toContain('portalPremium.surfaceRaised');
    expect(domGlass).toContain('PORTAL_GLASS_DOM_PRESETS');
    expect(domGlass).toContain(
      "bindLlganGlassSurface(node, kind, portal.active, surfaceTone === 'light')",
    );
  });

  it('makes shared forms, panels, tabs, filters, lists and dividers portal-aware', () => {
    const files = [
      'src/components/ui/SectionPanel.tsx',
      'src/components/ui/PremiumInput.tsx',
      'src/components/ui/SegmentedTabs.tsx',
      'src/components/ui/FilterChip.tsx',
      'src/components/ui/PremiumListRow.tsx',
      'src/components/ui/PremiumDivider.tsx',
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).toContain('portalPremium');
      expect(source, file).toContain('usePortalPremiumTheme');
    }
  });

  it('removes the old dark client appointment and signature surfaces', () => {
    const card = read('src/components/portal/ClientPortalAssignmentCard.tsx');
    const appointments = read('src/components/portal/PortalAppointmentsTab.tsx');
    const signatures = read('src/screens/portal/ClientDocumentSignaturesScreen.tsx');
    const guide = read('src/components/portal/ClientPortalGuide.tsx');
    const combined = [card, appointments, signatures, guide].join('\n');
    expect(combined).toContain('portalPremium.surfaceRaised');
    expect(card).toContain("colors={['#FFFFFF', '#F2F8FF', '#E3F1FF']}");
    expect(combined).not.toContain("backgroundColor: 'rgba(4,24,51,0.76)'");
    expect(combined).not.toContain("backgroundColor: 'rgba(8,39,75,0.84)'");
    expect(combined).not.toContain('liquidColors.white64');
  });

  it('uses readable premium cards for help, profile, message and detail pages', () => {
    const help = read('src/screens/portal/ClientPortalHelpScreen.tsx');
    const profile = read('src/screens/portal/ClientPortalProfileScreen.tsx');
    const message = read('src/screens/portal/PortalClientMessageDetailScreen.tsx');
    const appointment = read('src/screens/portal/PortalClientAppointmentDetailScreen.tsx');
    expect(help).toContain('backgroundColor: portalPremium.surfaceRaised');
    expect(help).toContain('color: portalPremium.text.primary');
    expect(profile).toContain('borderBottomColor: portalPremium.borderSoft');
    expect(message).toContain('backgroundColor: portalPremium.surfaceSoft');
    expect(appointment).toContain('backgroundColor: portalPremium.surfaceRaised');
  });

  it('keeps all employee work pages on the same light portal palette', () => {
    const files = [
      'src/components/timeTracking/TimeTrackingEmployeeScreen.tsx',
      'src/components/wfm/EmployeePortalTimesScreen.tsx',
      'src/components/wfm/WfmAbsencePortalScreen.tsx',
      'src/components/portal/EmployeeMobilitySettingsForm.tsx',
      'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx',
      'src/components/portal/EmployeePortalVisitWorkflowTimeline.tsx',
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).toContain('portalPremium');
      expect(source, file).not.toContain('spatialCare.textOnNight');
    }
  });

  it('uses contained mobile mascot layouts and full-width guide actions in both portals', () => {
    const client = read('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    const employee = read('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    expect(client).toContain("flexDirection: 'column'");
    expect(client).toContain('guideActionPhone');
    expect(client).toContain("width: '100%', alignSelf: 'stretch'");
    expect(employee).toContain('guideBubbleCompact');
    expect(employee).toContain('guideActionCompact');
    expect(employee).toContain("flexDirection: 'row', alignItems: 'flex-start'");
    expect(employee).toContain('guideMascotCompact: { width: 52, height: 61');
  });

  it('uses system icons rather than emoji text for portal navigation cards and empty states', () => {
    const kpi = read('src/components/portal/assist/MobilePortalKpiCard.tsx');
    const empty = read('src/components/portal/PortalEmptyState.tsx');
    expect(kpi).toContain('SpaceKpiIcon');
    expect(kpi).not.toContain('<Text style={styles.icon}>{icon}</Text>');
    expect(empty).toContain('<Ionicons');
    expect(empty).not.toContain('<Text style={styles.icon}>{icon}</Text>');
  });
});
