import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('client operational data R15', () => {
  it('persists the complete ambulatory record even when trigger fields are empty', () => {
    const source = read('src/lib/clients/clientIntakePersistence.ts');
    expect(source).not.toContain('const hasAmbulatoryData');
    for (const field of [
      'key_safe_code',
      'hazard_notes',
      'smoker_household',
      'aids_on_site',
      'hygiene_notes',
      'infection_notes',
    ]) {
      expect(source).toContain(field);
    }
  });

  it('projects safety data into employee assignments', () => {
    const source = read('src/lib/portal/employeePortalExecutionLiveService.ts');
    expect(source).toContain("section('Gefahren im Haushalt'");
    expect(source).toContain("section('Infektionshinweis'");
    expect(source).toContain("section('Hilfsmittel vor Ort'");
    expect(source).toContain('Raucherhaushalt: Ja');
  });

  it('changes status and generates care-level dependent document successors', () => {
    const repository = read('src/lib/clients/repositories/clientIntakeRepository.supabase.ts');
    const service = read('src/lib/clients/clientCareLevelDocumentSync.ts');
    expect(repository).toContain('workflowStatusToRemote');
    expect(service).toContain('CARE_LEVEL_DOCUMENT_TYPES');
    expect(service).toContain('pending_signature');
    expect(service).toContain('care_level_successor_generated');
    expect(service).toContain('Signed/finalized evidence is immutable');
  });

  it('uses a sanitized client portal function and assigned-employee RLS', () => {
    const migration = read(
      'supabase/migrations/20260731150000_client_operational_data_portal_sync.sql',
    );
    expect(migration).toContain('get_client_portal_operational_profile');
    expect(migration).not.toMatch(/RETURNS TABLE \([\s\S]*key_safe_code/);
    expect(migration).toContain('portal_employee_assigned_operational_select');
    expect(migration).toContain('resolve_current_employee_id()');
  });
});
