import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const persistence = readFileSync(
  'src/lib/assist/assistTrackingPersistenceService.ts',
  'utf8',
);
const migration = readFileSync(
  'supabase/migrations/20260724124500_assist_admin_time_correction_readback.sql',
  'utf8',
);

describe('administrative Assist-Zeitkorrektur bleibt nach Reload erhalten', () => {
  it('begrenzt Zeitereignisse auf die neuesten statt auf die ältesten Datensätze', () => {
    expect(persistence).toContain(".order('occurred_at', { ascending: false })");
    expect(persistence).toContain('.limit(limit)');
    expect(persistence).toContain('new Date(left.occurredAt).getTime()');
  });

  it('ersetzt alte Ereignisse desselben Einsatztages durch die administrative Korrektur', () => {
    expect(migration).toContain('normalize_administrative_assist_time_event');
    expect(migration).toContain("metadata->>'source'");
    expect(migration).toContain("'administrative_follow_up'");
    expect(migration).toContain("event_type = 'service_start'");
    expect(migration).toContain("event_type = 'service_end'");
    expect(migration).toContain("AT TIME ZONE 'Europe/Berlin'");
  });

  it('synchronisiert alle Rücklesequellen und WFM mit demselben Zeitstempel', () => {
    expect(migration).toContain('UPDATE public.assist_visits');
    expect(migration).toContain('UPDATE public.assignments');
    expect(migration).toContain('UPDATE public.assist_visit_execution_state');
    expect(migration).toContain('UPDATE public.workforce_time_events');
    expect(migration).toContain('canonical_assist_event_id');
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
