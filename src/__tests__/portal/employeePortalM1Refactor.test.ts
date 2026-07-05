import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  EMPLOYEE_PORTAL_DRAWER_TAB_KEYS,
  EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS,
  PORTAL_EMPLOYEE_DRAWER_TABS,
  resolveEmployeePortalNavigationTabs,
} from '@/lib/navigation/employeePortalNavigation';
import { PORTAL_EMPLOYEE_TABS } from '@/lib/navigation/shellConfig';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee portal M.1 refactor', () => {
  it('primary bottom nav has five tabs including Kalender', () => {
    expect(EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS).toEqual([
      'overview',
      'assignments',
      'calendar',
      'messages',
      'profile',
    ]);
    expect(PORTAL_EMPLOYEE_TABS.find((tab) => tab.key === 'calendar')?.label).toBe('Kalender');
    expect(PORTAL_EMPLOYEE_TABS.find((tab) => tab.key === 'schedule')).toBeUndefined();
  });

  it('drawer exposes Klientenakten, Uploads, Dokumente, Unterschriften and Meine Zeiten', () => {
    expect(EMPLOYEE_PORTAL_DRAWER_TAB_KEYS).toEqual([
      'clients',
      'uploads',
      'documents',
      'signatures',
      'times',
    ]);
    expect(PORTAL_EMPLOYEE_DRAWER_TABS.map((tab) => tab.label)).toEqual([
      'Klientenakten',
      'Uploads / Dokumente',
      'Dokumente',
      'Unterschriften',
      'Meine Zeiten',
    ]);
    const all = resolveEmployeePortalNavigationTabs(PORTAL_EMPLOYEE_TABS);
    expect(all.length).toBe(10);
  });

  it('PortalShellLayout uses drawer tabs with extended navigation', () => {
    const shell = readSrc('src/components/layout/portal/PortalShellLayout.tsx');
    expect(shell).toContain('resolveEmployeePortalNavigationTabs');
    expect(shell).toContain('drawerTabs');
  });

  it('employee assignment cards use light surface text on opaque cards', () => {
    const card = readSrc('src/components/portal/EmployeePortalAssignmentCard.tsx');
    expect(card).toContain('lightSurfaceText');
    expect(card).not.toContain('useAuroraAdaptiveText');
    expect(card).not.toContain('color: \'#fff\'');
    expect(card).not.toContain('color: "#fff"');
  });

  it('PortalAppointmentsTab integrates preview sheet for employees', () => {
    const tab = readSrc('src/components/portal/PortalAppointmentsTab.tsx');
    expect(tab).toContain('EmployeePortalAssignmentCard');
    expect(tab).toContain('EmployeePortalAssignmentPreviewSheet');
  });

  it('employee messages use default messenger variant for readable composer', () => {
    const screen = readSrc('src/screens/portal/portalofficemessagesscreens.tsx');
    expect(screen).toMatch(
      /EmployeePortalOfficeMessagesScreen[\s\S]*PortalOfficeMessenger audience="employee" variant="default"/,
    );
  });

  it('client records are read-only in UI', () => {
    expect(readSrc('src/components/portal/EmployeePortalClientRecordsScreen.tsx')).toContain(
      'Nur-Lese-Ansicht',
    );
    expect(readSrc('src/components/portal/EmployeePortalClientRecordDetailScreen.tsx')).toContain(
      'keine Bearbeitung',
    );
  });

  it('upload service creates office intake via portal_uploads', () => {
    const service = readSrc('src/lib/portal/employeePortalUploadService.ts');
    expect(service).toContain('portal_uploads');
    expect(service).toContain('createPortalRequest');
    expect(service).toContain('upload_context');
  });

  it('calendar service supports employee portal team events', () => {
    const service = readSrc('src/lib/calendar/calendarEventService.ts');
    expect(service).toContain('buildEmployeePortalCalendarConfig');
    expect(service).toContain('getEmployeePortalCalendarEvents');
    expect(service).toContain('getEmployeePortalTeamCalendarEvents');
    expect(service).toContain("defaultView: 'agenda'");
  });

  it('client records service uses valid clients columns', () => {
    const service = readSrc('src/lib/portal/employeePortalClientRecordsService.ts');
    expect(service).toContain('care_level');
    expect(service).not.toContain('care_grade');
    expect(service).not.toContain('notes_for_employee');
    expect(service).not.toContain('access_hint');
    expect(service).toContain('client_addresses');
  });

  it('migration 0226 extends portal_uploads for employees', () => {
    const migration = readSrc('supabase/migrations/0226_employee_portal_uploads.sql');
    expect(migration).toContain('employee_id');
    expect(migration).toContain('upload_context');
    expect(migration).toContain('portal_uploads_employee_portal_insert');
  });
});
