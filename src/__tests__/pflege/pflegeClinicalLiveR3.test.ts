import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Pflege Clinical Live R3 acceptance', () => {
  it('uses one productive medication workflow from every visible route', () => {
    const route = read('app/pflege/medikation/[id]/gabe.tsx');
    const detail = read('src/screens/pflege/MedicationDetailScreen.tsx');
    const legacyWorkflow = read('src/lib/pflege/clinicalWorkflowService.ts');
    expect(route).toContain('/pflege/medikation/${id}');
    expect(detail).toContain('recordMedicationAdministration');
    expect(legacyWorkflow).not.toContain('record_clinical_medication_administration');
    expect(read('src/screens/pflege/index.ts')).not.toContain('MedicationAdministrationScreen');
  });

  it('applies granular medication permissions and active-case isolation', () => {
    const service = read('src/lib/pflege/medicationLiveService.ts');
    const migration = read('supabase/migrations/20260812153000_live_medication_ambulatory_intensive.sql');
    for (const permission of [
      'pflege.medications.view',
      'pflege.medications.manage',
      'pflege.medications.administer',
    ]) expect(`${service}${migration}`).toContain(permission);
    expect(migration).toContain('public.is_active_pfleger_client(client_id)');
    expect(migration).toContain('administered_by = public.resolve_current_profile_id()');
  });

  it('uses server time, returns the persisted row and keeps administrations append-only', () => {
    const service = read('src/lib/pflege/medicationLiveService.ts');
    const migration = read('supabase/migrations/20260812153000_live_medication_ambulatory_intensive.sql');
    expect(service).not.toContain('administered_at: new Date().toISOString()');
    expect(service).toContain("select('id,administered_at,administered_by')");
    expect(migration).toContain('new.administered_at := clock_timestamp()');
    expect(migration).toContain('revoke update, delete on public.medication_administrations');
  });

  it('remains compatible with production profile drift and resolved profile IDs', () => {
    const vitals = read('supabase/migrations/20260812100000_vital_signs_live_final.sql');
    const clinical = read('supabase/migrations/20260812101500_pfleger_clinical_documentation_r2.sql');
    const medication = read('supabase/migrations/20260812153000_live_medication_ambulatory_intensive.sql');
    expect(`${vitals}${clinical}${medication}`).not.toMatch(/p\.(role_key|first_name|last_name|full_name|status)/);
    expect(vitals).toContain('public.resolve_current_profile_id()');
    expect(clinical).toContain('public.clinical_actor_id()');
    expect(medication.indexOf("if new.status <> 'scheduled'")).toBeGreaterThan(medication.indexOf('returns trigger'));
  });
});
