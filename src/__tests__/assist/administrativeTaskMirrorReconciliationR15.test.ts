import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20260807140000_administrative_bulk_task_reconciliation.sql',
  'utf8',
);
const panel = readFileSync(
  'src/components/assist/AdministrativeVisitFollowUpPanel.tsx',
  'utf8',
);

describe('R15 administrative Aufgaben-Spiegelabstimmung', () => {
  it('akzeptiert die in der Oberfläche sichtbare Assignment-Aufgaben-ID', () => {
    expect(panel).toContain('taskId: task.id');
    expect(migration).toContain('FROM public.assignment_tasks t');
    expect(migration).toContain('t.id = v_source_id');
    expect(migration).toContain("v_assignment_id := coalesce(v_visit.legacy_assignment_id, v_visit.id)");
  });

  it('löst die korrespondierende Visit-Aufgabe über Titel und Sortierung auf', () => {
    expect(migration).toContain('FROM public.assist_visit_tasks t');
    expect(migration).toContain('t.title = v_title');
    expect(migration).toContain('t.sort_order = v_sort_order');
  });

  it('schreibt beide Aufgabenbestände in derselben Transaktion', () => {
    expect(migration).toContain('UPDATE public.assist_visit_tasks');
    expect(migration).toContain('UPDATE public.assignment_tasks');
    expect(migration).toContain("WHEN 'not_possible' THEN 'not_done'");
    expect(migration).toContain("WHEN 'deferred' THEN 'not_done'");
  });

  it('bleibt tenant-gebunden und protokolliert beide IDs', () => {
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain("'task_updated_reconciled'");
    expect(migration).toContain("'visit_task_id', v_visit_task_id");
    expect(migration).toContain("'assignment_task_id', v_assignment_task_id");
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('verwirft eine nicht mehr vorhandene Alt-Aufgabe ohne den Einsatz zu blockieren', () => {
    expect(migration).not.toContain("RAISE EXCEPTION 'Aufgabe nicht gefunden'");
    expect(migration).toContain("'stale_task_reference_discarded'");
    expect(migration).toContain('v_skipped := v_skipped + 1');
    expect(migration).toContain("'skipped', v_skipped");
    expect(panel).toContain('nicht mehr vorhandene Aufgabe wurde entfernt');
  });
});
