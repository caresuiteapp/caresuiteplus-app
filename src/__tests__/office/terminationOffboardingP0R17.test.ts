import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Kündigung und Offboarding P0 R17', () => {
  const migration = read('supabase/migrations/20260901143000_client_employee_offboarding_p0_r17.sql');
  const clientService = read('src/lib/office/offboarding/clientOffboardingService.ts');
  const clientScreen = read('src/screens/office/ClientOffboardingScreen.tsx');
  const clientDetail = read('src/screens/office/ClientDetailScreen.tsx');
  const employeeService = read('src/lib/office/offboarding/employeeOffboardingService.ts');
  const employeeGate = read('src/lib/office/offboarding/employeeOffboardingProductionGate.ts');
  const legacyClientService = read('src/lib/services/clients/clientService.ts');
  const employeeDeleteService = read('src/lib/office/employeeDeleteService.ts');

  it('liefert einen eigenständigen Klient:innen-Prozess aus der digitalen Akte', () => {
    expect(clientDetail).toContain('Kündigung & Offboarding öffnen');
    expect(clientDetail).toContain('/offboarding');
    expect(clientScreen).toContain('Kein Löschen – vollständige Historie bleibt erhalten');
    expect(fs.existsSync(path.join(root, 'app/office/clients/[id]/offboarding.tsx'))).toBe(true);
  });

  it('erfasst Kündigungsart, Fristen, internen und externen Grund sowie Legal Hold', () => {
    for (const token of ['terminationKind', 'noticeDate', 'effectiveDate', 'lastServiceDate', 'internalReason', 'externalReason', 'legalHold']) {
      expect(clientScreen).toContain(token);
    }
    expect(migration).toContain('extraordinary_by_provider');
    expect(migration).toContain('portal_closure_mode');
  });

  it('blockiert den Klient:innen-Abschluss bei offenen Einsätzen, Doku, Unterschrift und Abrechnung', () => {
    for (const key of ['open_assignments', 'open_documentation', 'open_signatures', 'open_billing', 'stakeholder_notifications', 'documents_export', 'final_protocol']) {
      expect(migration).toContain(`'${key}'`);
    }
    expect(migration).toContain("severity='required' AND status='failed'");
    expect(migration).toContain('RAISE EXCEPTION \'Endfreigabe blockiert: %\'');
  });

  it('sperrt Portal und Push-Geräte serverseitig', () => {
    expect(migration).toContain('UPDATE public.client_portal_access SET portal_enabled=FALSE');
    expect(migration).toContain('UPDATE public.portal_push_devices SET enabled=FALSE,invalidated_at=NOW()');
    expect(clientService).toContain("rpc('lock_client_offboarding_portal'");
  });

  it('speichert einen revisionssicheren Abschluss-Snapshot statt eines UI-Häkchens', () => {
    expect(migration).toContain('final_protocol JSONB');
    expect(migration).toContain('CareSuite-Client-Offboarding-R17');
    expect(migration).toContain('generate_client_offboarding_protocol');
    expect(clientService).toContain("rpc('generate_client_offboarding_protocol'");
  });

  it('verbietet direkte Tabellenmutation und schützt Systemschritte', () => {
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.client_offboarding_cases FROM authenticated');
    expect(migration).toContain("p_action_key IN ('lock_portal_access','create_final_protocol','archive_client_record')");
    expect(migration).not.toContain('DELETE FROM public.clients');
    expect(migration).not.toContain('DELETE FROM public.employees');
    expect(legacyClientService).toContain('Direkte Archivierung ist gesperrt');
    expect(legacyClientService).toContain("newStatus === 'archiviert'");
    expect(legacyClientService).toContain('Ehemalige oder im Offboarding befindliche Klient:innen werden nicht gelöscht');
    expect(employeeDeleteService).toContain('Ehemalige oder im Offboarding befindliche Mitarbeitende werden nicht gelöscht');
  });

  it('härtet das Mitarbeitenden-Offboarding mit echten Live-Daten', () => {
    for (const table of ['assist_tracking_sessions', 'employee_logbook_trips', 'workforce_work_sessions', 'assist_visits', 'employee_expense_claims', 'inventory_assignments', 'portal_push_devices']) {
      expect(migration).toContain(`'public.${table}'`);
    }
    expect(employeeGate).toContain("rpc('employee_offboarding_production_gate'");
    for (const key of ['open_documentation', 'open_signatures', 'open_corrections', 'open_inventory']) expect(migration).toContain(`'${key}'`);
    expect(employeeService).toContain('fetchEmployeeOffboardingProductionGate');
    expect(employeeService).toContain('invalidateEmployeeOffboardingPushDevices');
    for (const blocker of ['work_time_open', 'payroll_not_prepared', 'external_access_not_prepared', 'documents_incomplete', 'reference_missing', 'return_protocol_missing']) {
      expect(employeeService).toContain(`'${blocker}'`);
    }
  });
});
