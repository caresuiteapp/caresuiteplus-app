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
const premiumButton = readFileSync('src/components/ui/PremiumButton.tsx', 'utf8');
const careLightButton = readFileSync('src/components/ui/CareLightButton.tsx', 'utf8');

describe('administrative Sammelnachbearbeitung', () => {
  it('macht die gemeinsame Begründung sichtbar und behält sie für alle Aktionen', () => {
    expect(panel).toContain('Gemeinsame Begründung für die Nachbearbeitung');
    expect(panel).toContain('Einmal eingeben');
    expect(panel).not.toContain("setReason('');");
  });

  it('sammelt Aufgabenänderungen und speichert sie gemeinsam', () => {
    expect(panel).toContain('Alle erledigt');
    expect(panel).toContain('Aufgaben gemeinsam speichern');
    expect(panel).toContain('bulkUpdateAdministrativeTasks');
    expect(service).toContain("admin_bulk_update_assist_visit_tasks");
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

  it('respektiert gesperrte Aktionen auch in der hellen Desktop-Oberfläche', () => {
    expect(premiumButton).toContain('disabled={disabled}');
    expect(careLightButton).toContain('disabled={disabled || loading}');
    expect(careLightButton).toContain('accessibilityState={{ disabled: disabled || loading }}');
  });
});
