import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Atomarer Einsatz-Löschvorgang', () => {
  const migration = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'supabase/migrations/20260727050000_assist_visit_atomic_delete.sql',
    ),
    'utf8',
  );

  it('prüft Mandant und Anmeldung, aber blockiert keinen Bearbeitungsstatus', () => {
    expect(migration).toContain('auth.uid() IS NULL');
    expect(migration).toContain('public.is_tenant_member(p_tenant_id)');
    expect(migration).not.toContain("execution_status::TEXT NOT IN ('pending', 'cancelled')");
    expect(migration).not.toContain('actual_start_at IS NOT NULL');
    expect(migration).not.toContain("billing_status::TEXT IN ('invoiced', 'paid')");
  });

  it('löscht Live-Einsatz und Legacy-Spiegel in derselben Transaktion', () => {
    expect(migration).toContain('DELETE FROM public.assist_visits');
    expect(migration).toContain('DELETE FROM public.assignments');
    expect(migration).toContain("'deleted', TRUE");
    expect(migration).toContain('GRANT EXECUTE');
  });
});
