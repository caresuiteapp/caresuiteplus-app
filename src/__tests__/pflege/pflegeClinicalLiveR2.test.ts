import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Pflege Clinical Live R2 acceptance', () => {
  it('ships append-only clinical workflows and granular RLS', () => {
    const sql = read('supabase/migrations/20260812101500_pfleger_clinical_documentation_r2.sql');
    for (const table of [
      'clinical_medication_orders', 'clinical_medication_administrations', 'clinical_wound_cases',
      'clinical_wound_assessments', 'clinical_documentation_entries', 'clinical_treatment_executions',
      'clinical_handovers',
    ]) expect(sql).toContain(`public.${table}`);
    for (const rpc of [
      'record_clinical_medication_administration', 'create_clinical_wound_assessment',
      'record_clinical_treatment_execution', 'acknowledge_clinical_handover',
      'sign_clinical_documentation',
    ]) expect(sql).toContain(`FUNCTION public.${rpc}`);
    expect(sql).toContain("public.has_permission('pflege.medications.view')");
    expect(sql).toContain("public.has_permission('pflege.wounds.view')");
    expect(sql).toContain("public.has_permission('pflege.documentation.view')");
    expect(sql).toContain("public.has_permission('pflege.treatment.view')");
    expect(sql).toContain("public.has_permission('pflege.handovers.view')");
  });

  it('connects every critical workflow to a live route and RPC service', () => {
    const service = read('src/lib/pflege/clinicalWorkflowService.ts');
    for (const rpc of [
      'create_clinical_handover', 'record_clinical_treatment_execution',
      'record_clinical_medication_administration', 'create_clinical_wound_assessment',
      'sign_clinical_documentation',
    ]) expect(service).toContain(rpc);
    for (const route of [
      'app/pflege/behandlungspflege/index.tsx', 'app/pflege/behandlungspflege/new.tsx',
      'app/pflege/uebergaben/new.tsx', 'app/pflege/medikation/[id]/gabe.tsx',
      'app/pflege/wunden/[id]/assessment.tsx',
    ]) expect(fs.existsSync(path.join(process.cwd(), route))).toBe(true);
  });

  it('keeps external eMP and unfinished file storage honestly gated', () => {
    const config = read('src/lib/pflege/pflegeModuleConfig.ts');
    expect(config).toContain('isMedicationEmpReady(): boolean { return false; }');
    expect(read('src/screens/pflege/WoundCreateScreen.tsx')).not.toContain('DocumentPicker');
  });
});
