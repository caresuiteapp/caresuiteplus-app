import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  EMPLOYEE_PORTAL_NAV_LABELS,
  EMPLOYEE_PORTAL_NAV_TABS,
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
  it('primary bottom nav keeps the five daily destinations', () => {
    expect(EMPLOYEE_PORTAL_PRIMARY_TAB_KEYS).toEqual([
      'overview',
      'assignments',
      'calendar',
      'messages',
      'profile',
    ]);
    expect(PORTAL_EMPLOYEE_TABS.map((tab) => tab.label)).toEqual([
      'Übersicht',
      'Einsätze',
      'Kalender',
      'Nachrichten',
      'Profil',
    ]);
    expect(PORTAL_EMPLOYEE_TABS.find((tab) => tab.key === 'calendar')?.label).toBe('Kalender');
    expect(PORTAL_EMPLOYEE_TABS.find((tab) => tab.key === 'schedule')).toBeUndefined();
  });

  it('drawer navigation has no duplicate times or documents entries', () => {
    expect(EMPLOYEE_PORTAL_NAV_LABELS).toEqual([
      'Übersicht',
      'Einsätze',
      'Kalender',
      'Nachrichten',
      'Profil',
      'Uploads',
      'Klientenakten',
      'Dokumente & Unterschriften',
      'Arbeitszeiten',
    ]);
    expect(PORTAL_EMPLOYEE_DRAWER_TABS.map((tab) => tab.label)).toEqual([
      'Uploads',
      'Klientenakten',
      'Dokumente & Unterschriften',
      'Arbeitszeiten',
    ]);
    const all = resolveEmployeePortalNavigationTabs(PORTAL_EMPLOYEE_TABS);
    expect(all).toHaveLength(9);
    expect(all.map((tab) => tab.label)).not.toContain('Meine Zeiten');
    expect(all.map((tab) => tab.label)).not.toContain('Dokumente');
    expect(all.map((tab) => tab.label)).not.toContain('Offene Aufgaben');
    expect(all.map((tab) => tab.key)).toEqual(EMPLOYEE_PORTAL_NAV_TABS.map((tab) => tab.key));
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

  it('client records detail supports phone actions and document preview', () => {
    const detail = readSrc('src/components/portal/EmployeePortalClientRecordDetailScreen.tsx');
    expect(detail).toContain('PhoneActionRow');
    expect(detail).toContain('EmployeePortalClientDocumentPreviewSheet');
    expect(detail).toContain('dialPhoneNumber');
    expect(detail).toContain('Nur-Lese-Ansicht');
  });

  it('client records service loads extended client fields and portal documents', () => {
    const service = readSrc('src/lib/portal/employeePortalClientRecordsService.ts');
    expect(service).toContain('CLIENT_DETAIL_SELECT');
    expect(service).toContain('visible_notes_for_employee');
    expect(service).toContain('fetchEmployeePortalClientDocuments');
    expect(service).toContain('mobile');
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

  it('client records service uses valid clients columns and direct assist_visits load', () => {
    const service = readSrc('src/lib/portal/employeePortalClientRecordsService.ts');
    expect(service).toContain('CLIENT_LIST_SELECT');
    expect(service).toContain('CLIENT_DETAIL_SELECT');
    expect(service).toContain('care_level');
    expect(service).toContain('postal_code');
    expect(service).not.toContain('care_grade');
    expect(service).not.toMatch(/CLIENT_LIST_SELECT\s*=\s*'[^']*\bzip\b/);
    expect(service).toContain('loadEmployeeClientVisits');
    expect(service).toContain('assist_visits');
    expect(service).not.toMatch(/assist_visits[\s\S]*clients\(/);
  });

  it('visit repository client embed avoids missing production columns', () => {
    const repo = readSrc('src/lib/assist/repositories/visitRepository.supabase.ts');
    expect(repo).toContain('CLIENT_LOCATION_SELECT');
    expect(repo).not.toMatch(/clients\([\s\S]*house_number/);
    expect(repo).not.toMatch(/CLIENT_LOCATION_SELECT[\s\S]*\bzip\b/);
  });

  it('migration 0226 extends portal_uploads for employees', () => {
    const migration = readSrc('supabase/migrations/0226_employee_portal_uploads.sql');
    expect(migration).toContain('employee_id');
    expect(migration).toContain('upload_context');
    expect(migration).toContain('portal_uploads_employee_portal_insert');
  });
});
