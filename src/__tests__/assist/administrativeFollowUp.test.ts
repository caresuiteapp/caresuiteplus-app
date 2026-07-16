import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildDueExecutionItems } from '@/lib/assist/executionListService';
import { validateAdministrativeTimes } from '@/lib/assist/administrativeVisitService';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';

const base: VisitDispositionListItem = {
  id: 'visit-1', tenantId: 'tenant', clientId: 'client', title: 'Einsatz', serviceName: 'Betreuung',
  scheduledStart: '2026-07-15T08:00:00Z', scheduledEnd: '2026-07-15T09:00:00Z', durationMinutes: 60,
  status: 'geplant', assignmentStatus: 'geplant', planningStatus: 'scheduled', executionStatus: 'pending',
  documentationStatus: 'open', proofStatus: 'pending', billingStatus: 'none', location: 'Berlin',
  clientName: 'Klient', employeeId: 'employee', employeeName: 'Mitarbeiter', isAtRisk: false, isIncomplete: true, updatedAt: '2026-07-15T09:00:00Z',
};

describe('administrative Assist-Nachbearbeitung', () => {
  it('nimmt jeden fälligen Status auf und schließt zukünftige Einsätze aus', () => {
    const statuses = ['geplant','bestaetigt','unterwegs','angekommen','gestartet','beendet','dokumentation_offen','unterschrift_offen','abgeschlossen','storniert','nicht_erschienen'] as const;
    const visits: VisitDispositionListItem[] = [
      ...statuses.map((assignmentStatus, i) => ({ ...base, id: String(i), assignmentStatus })),
      { ...base, id: 'future', scheduledEnd: '2026-07-17T09:00:00Z' },
    ];
    expect(buildDueExecutionItems(visits, new Date('2026-07-16T12:00:00Z'))).toHaveLength(statuses.length);
  });
  it('zeigt Entwürfe ausschließlich bei echtem Fehlerfall', () => {
    const clean = { ...base, id: 'clean', planningStatus: 'draft' as const, isIncomplete: false };
    const faulty = { ...clean, id: 'faulty', isAtRisk: true };
    expect(buildDueExecutionItems([clean, faulty], new Date('2026-07-16T12:00:00Z')).map(x => x.assignmentId)).toEqual(['faulty']);
  });
  it('validiert Begründung und Zeitfolge', () => {
    expect(validateAdministrativeTimes({ startedAt: '2026-07-15T10:00:00Z', endedAt: '2026-07-15T09:00:00Z', pauseMinutes: 0, reason: 'Korrektur' })).toMatch(/vor Einsatzende/);
    expect(validateAdministrativeTimes({ startedAt: '2026-07-15T08:00:00Z', endedAt: '2026-07-15T09:00:00Z', pauseMinutes: 0, reason: '' })).toMatch(/Begründung/);
  });
  it('Migration erzwingt Idempotenz, Audit, Client-RLS und WFM-SSOT', () => {
    const sql = readFileSync('supabase/migrations/0255_assist_administrative_follow_up.sql', 'utf8');
    expect(sql).toContain('sync_assist_visit_times_to_wfm');
    expect(sql).toContain("metadata->>'source' = 'administrative_follow_up'");
    expect(sql).toContain("'administrative_follow_up'");
    expect(sql).toContain('client_id = public.current_client_id()');
    expect(sql).toContain('assist_visit_admin_audit');
    expect(sql).toContain('p_confirm_overlap');
    expect(sql).toContain('admin_append_assist_visit_documentation');
    expect(sql).toContain('admin_update_assist_visit_task');
    expect(sql).toContain('admin_complete_assist_visit_follow_up');
    expect(sql).toContain('Pflichtaufgaben sind noch offen');
  });
});
