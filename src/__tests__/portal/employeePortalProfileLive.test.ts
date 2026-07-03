import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PORTAL_EMPLOYEE_PROFILE_TABS } from '@/components/portal/profile/portalProfileTabs';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Employee portal profile live wiring', () => {
  it('profile hook resolves employeeId from portal actor', () => {
    const hook = readSrc('src/hooks/useEmployeePortalProfile.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('employeeId');
    expect(hook).not.toContain('useAuth');
  });

  it('personnel hook resolves employeeId from portal actor', () => {
    const hook = readSrc('src/hooks/useEmployeePortalPersonnelView.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('employeeId');
    expect(hook).not.toContain('useLocalSearchParams');
  });

  it('profile hook uses employee portal live refresh', () => {
    const hook = readSrc('src/hooks/useEmployeePortalProfile.ts');
    expect(hook).toContain('subscribeToEmployeePortalChanges');
    expect(hook).toContain('live:');
    expect(hook).toContain('isLiveConnected');
  });

  it('dashboard hook uses employee portal live refresh', () => {
    const hook = readSrc('src/hooks/useEmployeePortalDashboard.ts');
    expect(hook).toContain('subscribeToEmployeePortalChanges');
    expect(hook).toContain('live:');
    expect(hook).toContain('isLiveConnected');
  });

  it('profile service loads live Supabase data when employeeId is present', () => {
    const service = readSrc('src/lib/portal/employeeProfileService.ts');
    expect(service).toContain('fetchLiveEmployeePortalProfile');
    expect(service).toContain("getServiceMode() === 'supabase'");
    const live = readSrc('src/lib/portal/employeeProfileLiveService.ts');
    expect(live).toContain("fromUnknownTable(supabase, 'employees')");
    expect(live).not.toContain('getDemoEmployeeProfile');
  });

  it('personnel service loads live personnel view scoped to portal actor', () => {
    const service = readSrc('src/lib/portal/employeePortalPersonnelService.ts');
    expect(service).toContain('fetchLiveEmployeePortalPersonnelView');
    expect(service).toContain('portal.employee.profile.view');
    const live = readSrc('src/lib/portal/employeePortalPersonnelLiveService.ts');
    expect(live).toContain('loadEmployeePersonnelFileLive');
    expect(live).toContain('filterPersonnelDocumentsForViewer');
  });

  it('execution service delegates to live Supabase in supabase mode', () => {
    const service = readSrc('src/lib/portal/employeePortalExecutionService.ts');
    expect(service).toContain('fetchLiveEmployeePortalAssignmentDetail');
    expect(service).toContain('transitionLiveEmployeePortalAssignment');
    const live = readSrc('src/lib/portal/employeePortalExecutionLiveService.ts');
    expect(live).toContain('assignmentSupabaseRepository');
    expect(live).not.toContain('guardLiveDemoFeature');
  });

  it('profile hero uses employee avatar from profile data', () => {
    const hero = readSrc('src/components/portal/PortalEmployeeProfileHero.tsx');
    expect(hero).toContain('PortalReadOnlyAvatar');
    expect(hero).toContain('profile.avatarUrl');
    expect(hero).not.toContain('authProfile?.avatarUrl');
    expect(hero).not.toContain('TopbarProfileAvatar');
  });

  it('profile hero defines avatar before useMemo styles', () => {
    const hero = readSrc('src/components/portal/PortalEmployeeProfileHero.tsx');
    const avatarIdx = hero.indexOf('PortalReadOnlyAvatar');
    const useMemoIdx = hero.indexOf('useMemo(');
    expect(avatarIdx).toBeGreaterThan(-1);
    expect(useMemoIdx).toBeGreaterThan(avatarIdx);
  });

  it('migration 0189 adds employee portal self-select RLS', () => {
    const sql = readSrc('supabase/migrations/0189_employee_portal_live_rls.sql');
    expect(sql).toContain('employees_portal_self_select');
    expect(sql).toContain('assignments_portal_employee_select');
    expect(sql).toContain('resolve_current_employee_id()');
  });

  it('profile screen exposes all 14 read-only tabs', () => {
    const screen = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    expect(screen).toContain('PORTAL_EMPLOYEE_PROFILE_TABS');
    expect(screen).toContain('PortalEmployeeProfileTabContent');
    expect(screen).toContain('SegmentedTabs');
    expect(PORTAL_EMPLOYEE_PROFILE_TABS).toHaveLength(14);
  });

  it('profile screen is read-only with office hint and no edit button', () => {
    const screen = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    expect(screen).toContain('missingEmployeeLink');
    expect(screen).toContain('OFFICE_PROFILE_HINT');
    expect(screen).not.toContain('Bearbeiten');
    expect(screen).not.toContain('Stammdaten ändern');
    expect(screen).not.toContain('Löschen');
    const hint = readSrc('src/components/portal/profile/portalProfileTabs.ts');
    expect(hint).toContain('Änderungen an Ihren Stammdaten nimmt das Office vor');
  });

  it('profile screen handles missing employee link with friendly message', () => {
    const screen = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    expect(screen).toContain(
      'Ihr Portalzugang ist noch keinem Mitarbeiterprofil zugeordnet',
    );
  });

  it('profile live service loads extended employee fields', () => {
    const live = readSrc('src/lib/portal/employeeProfileLiveService.ts');
    expect(live).toContain('employment_type');
    expect(live).toContain('entry_date');
    expect(live).toContain('employee_number');
    expect(live).toContain('resolveEmploymentTypeLabel');
  });

  it('read-only avatar resolves employee photo with initials fallback', () => {
    const avatar = readSrc('src/components/portal/PortalReadOnlyAvatar.tsx');
    expect(avatar).toContain('resolveProfileAvatarDisplayUrl');
    expect(avatar).toContain('PremiumAvatar');
    expect(avatar).not.toContain('saveUserProfileAvatar');
  });

  it('personnel projection masks IBAN and tax ID for portal', () => {
    const projection = readSrc('src/lib/portal/employeePortalPersonnelProjection.ts');
    expect(projection).toContain('maskPortalIban');
    expect(projection).toContain('maskPortalTaxId');
    const masking = readSrc('src/lib/portal/employeePortalPersonnelMasking.ts');
    expect(masking).toContain('maskPortalIban');
    expect(masking).toContain('maskPortalTaxId');
  });

  it('roles tab shows user-friendly labels without permission keys', () => {
    const projection = readSrc('src/lib/portal/employeePortalPersonnelProjection.ts');
    expect(projection).toContain('ROLE_LABELS');
    expect(projection).toContain('Freigegebene Bereiche');
    expect(projection).not.toContain('permission.');
    const tabContent = readSrc('src/components/portal/profile/PortalEmployeeProfileTabContent.tsx');
    expect(tabContent).not.toContain('PermissionKey');
  });

  it('documents tab filters to portal-released docs in live service', () => {
    const live = readSrc('src/lib/portal/employeePortalPersonnelLiveService.ts');
    expect(live).toContain('filterPersonnelDocumentsForViewer');
    const tabs = readSrc('src/components/portal/profile/portalProfileTabs.ts');
    expect(tabs).toContain('Keine für Sie freigegebenen Dokumente vorhanden.');
  });

  it('history tab avoids raw audit identifiers', () => {
    const projection = readSrc('src/lib/portal/employeePortalPersonnelProjection.ts');
    expect(projection).toContain('sanitizeHistorySummary');
    expect(projection).not.toContain('fieldChanges');
    const screen = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    expect(screen).not.toContain('auth_user_id');
    expect(screen).toContain('isTechnicalPortalErrorMessage');
  });

  it('profile tabs define empty states per section', () => {
    const tabs = readSrc('src/components/portal/profile/portalProfileTabs.ts');
    expect(tabs).toContain('Keine Daten hinterlegt.');
    expect(tabs).toContain('Noch keine sichtbaren Änderungen vorhanden.');
  });

  it('mobile profile uses scrollable pill navigation', () => {
    const screen = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    expect(screen).toContain('layout={tabLayout}');
    expect(screen).toContain("'scroll'");
  });
});

describe('Employee portal appointment detail live wiring', () => {
  it('appointment detail hook passes portal actor context', () => {
    const hook = readSrc('src/hooks/usePortalAppointmentDetail.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('tenantId');
    expect(hook).toContain('employeeId');
  });

  it('appointment service loads live employee assignment detail', () => {
    const service = readSrc('src/lib/portal/appointmentService.ts');
    expect(service).toContain('fetchLiveEmployeePortalAssignmentDetail');
  });
});

describe('Employee portal personnel masking unit', () => {
  it('masks IBAN with partial reveal', async () => {
    const { maskPortalIban, maskPortalTaxId } = await import(
      '@/lib/portal/employeePortalPersonnelMasking'
    );
    expect(maskPortalIban('DE89370400440532013000')).toBe('DE•• •••• •••• •••• 3000');
    expect(maskPortalTaxId('12345678901')).toBe('•••• •••• 8901');
  });
});
