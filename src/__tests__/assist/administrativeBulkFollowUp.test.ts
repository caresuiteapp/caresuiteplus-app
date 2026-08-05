import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const panel = readFileSync(
  'src/components/assist/AdministrativeVisitFollowUpPanel.tsx',
  'utf8',
);
const service = readFileSync(
  'src/lib/assist/administrativeVisitService.ts',
  'utf8',
);
const migration = readFileSync(
  'supabase/migrations/0257_assist_administrative_bulk_follow_up.sql',
  'utf8',
);
const liveRepair = readFileSync(
  'supabase/migrations/0266_assist_administrative_follow_up_live_repair.sql',
  'utf8',
);
const actorFkRepair = readFileSync(
  'supabase/migrations/0267_assist_administrative_actor_fk_repair.sql',
  'utf8',
);
const runtimeRepair = readFileSync(
  'supabase/migrations/0271_employee_runtime_and_follow_up_repair.sql',
  'utf8',
);
const reconciliationRepair = readFileSync(
  'supabase/migrations/20260805160000_administrative_signature_and_task_reconciliation.sql',
  'utf8',
);
const executionScreen = readFileSync('src/screens/assist/VisitExecutionScreen.tsx', 'utf8');
const premiumButton = readFileSync('src/components/ui/PremiumButton.tsx', 'utf8');
const careLightButton = readFileSync('src/components/ui/CareLightButton.tsx', 'utf8');

describe('administrative Sammelnachbearbeitung', () => {
  it('macht die Nachbearbeitung ohne vorgeschaltete Pflichtbegründung sofort nutzbar', () => {
    expect(panel).not.toContain('Gemeinsame Begründung für die Nachbearbeitung');
    expect(panel).not.toContain('setReason');
    expect(panel).not.toContain('!reason.trim()');
    expect(panel).toContain('automatisch revisionssicher protokolliert');
    expect(service).toContain("const AUTOMATIC_ADMIN_AUDIT_REASON = 'Administrative Nachbearbeitung'");
  });

  it('sammelt Aufgabenänderungen und speichert sie gemeinsam', () => {
    expect(panel).toContain('Alle erledigt');
    expect(panel).toContain('Aufgaben gemeinsam speichern');
    expect(panel).toContain('bulkUpdateAdministrativeTasks');
    expect(service).toContain("admin_bulk_update_assist_visit_tasks");
    expect(panel).toMatch(/const completeFollowUp[\s\S]*visit\.tasks\.map[\s\S]*completeAdministrativeFollowUp/);
  });

  it('gleicht beim Abschluss die sichtbaren Assignment-Aufgaben atomar mit den Visit-Aufgaben ab', () => {
    expect(service).toContain('admin_reconcile_complete_assist_visit_follow_up');
    expect(reconciliationRepair).toContain('p_task_states JSONB');
    expect(reconciliationRepair).toContain('public.assignment_tasks');
    expect(reconciliationRepair).toContain('public.assist_visit_tasks');
    expect(reconciliationRepair).toContain("RAISE EXCEPTION 'Pflichtaufgaben sind noch offen: %'");
  });

  it('zeigt Aufgaben und Dokumentation in der Verwaltung nicht doppelt', () => {
    expect(executionScreen).toContain('const showAdministrativeFollowUp');
    expect(executionScreen).toContain('canManage && !showAdministrativeFollowUp');
    expect(panel).toContain('Bereits gespeichert:');
  });

  it('speichert alle Aufgaben atomar, tenant-sicher und mit Einzelaudit', () => {
    expect(migration).toContain('jsonb_array_elements(p_updates)');
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain('assist_visit_admin_audit');
    expect(migration).toContain("'task_updated'");
  });

  it('stellt die erforderlichen Verwaltungsrechte für Adminrollen vollständig bereit', () => {
    expect(migration).toContain("'assist.execution.manage'");
    expect(migration).toContain("'time.tracking.admin.correct'");
    expect(migration).toContain('ON CONFLICT (role_id, permission_key) DO NOTHING');
  });

  it('repariert den produktiven updated_by-Schemadrift und lädt PostgREST neu', () => {
    expect(liveRepair).toContain('ADD COLUMN IF NOT EXISTS updated_by');
    expect(liveRepair).toContain('admin_correct_assist_visit_times');
    expect(liveRepair).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('löst auth.uid für Actor-Fremdschlüssel auf die echte Profil-ID auf', () => {
    expect(actorFkRepair).toContain('resolve_current_profile_id');
    expect(actorFkRepair).toContain('p.auth_user_id = NEW.updated_by');
    expect(actorFkRepair).toContain('normalize_assist_visit_updated_by_trigger');
    expect(actorFkRepair).toContain('normalize_assist_time_event_recorded_by_trigger');
  });

  it('repariert Dokumentations-FK und erlaubt einen revisionssicheren Signaturaufschub', () => {
    expect(runtimeRepair).toContain('resolve_current_profile_id()');
    expect(runtimeRepair).toContain('submitted_by = v_actor');
    expect(runtimeRepair).toContain("status = 'open'");
    expect(runtimeRepair).toContain("billing_status = CASE WHEN v_signature_deferred THEN 'blocked' ELSE 'ready' END");
    expect(runtimeRepair).toContain('sync_deferred_assist_signature_completion_trigger');
    expect(runtimeRepair).toContain("status = 'signed'");
    expect(runtimeRepair).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('respektiert gesperrte Aktionen auch in der hellen Desktop-Oberfläche', () => {
    expect(premiumButton).toContain('disabled={isDisabled}');
    expect(premiumButton).toContain('const isDisabled = disabled || loading');
    expect(careLightButton).toContain('disabled={disabled}');
    expect(careLightButton).toContain('loading={loading}');
  });
});
