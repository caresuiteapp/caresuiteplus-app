import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20260724123000_assist_admin_time_booking_live_repair.sql',
  'utf8',
);

describe('Assist administrative Zeitbuchung live repair', () => {
  it('stellt RPC, Rechte und Profil-FK-Normalisierung unabhängig von Alt-Migrationen bereit', () => {
    expect(migration).toContain('admin_correct_assist_visit_times');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS updated_by');
    expect(migration).toContain('resolve_current_profile_id');
    expect(migration).toContain('normalize_assist_visit_updated_by_trigger');
    expect(migration).toContain('normalize_assist_time_event_recorded_by_trigger');
    expect(migration).toContain("'assist.execution.manage'");
    expect(migration).toContain("'time.tracking.admin.correct'");
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION');
  });

  it('spiegelt Korrekturwerte in Assist, WFM und Audit', () => {
    expect(migration).toContain('UPDATE public.assist_visits');
    expect(migration).toContain('INSERT INTO public.assist_time_events');
    expect(migration).toContain('UPDATE public.workforce_time_events');
    expect(migration).toContain('INSERT INTO public.workforce_time_events');
    expect(migration).toContain('employee_portal_accounts');
    expect(migration).toContain("'correction'");
    expect(migration).toContain('assist_visit_admin_audit');
    expect(migration).toContain("'times_corrected'");
    expect(migration).toContain("'net_minutes'");
  });

  it('bleibt tenant-sicher, validiert Zeitfolgen und bestätigt Überschneidungen bewusst', () => {
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain('Ungültige Zeitfolge');
    expect(migration).toContain('p_confirm_overlap');
    expect(migration).toContain("'overlap', TRUE");
    expect(migration).toContain("'overlap_confirmed'");
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
