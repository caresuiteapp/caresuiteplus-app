import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath =
  'supabase/migrations/20260803130000_assignment_profile_duration_complete_future_repair.sql';
const migration = readFileSync(path.join(root, migrationPath), 'utf8');

describe('R34 vollständige Zukunftskorrektur der Einsatzprofil-Dauer', () => {
  it('korrigiert jede sichere Zukunftsabweichung ohne Aufgabenzeit-Heuristik', () => {
    expect(migration).toContain('CREATE TEMP TABLE r34_profile_duration_targets');
    expect(migration).toContain('p.duration_minutes AS profile_duration_minutes');
    expect(migration).toContain('a.planned_start_at > NOW()');
    expect(migration).not.toContain('jsonb_array_elements');
    expect(migration).not.toContain('defaultDurationMinutes');
    expect(migration).not.toContain('task_drafts');
  });

  it('hält bereits operative oder abgeschlossene Einsätze vollständig aus dem Backfill', () => {
    expect(migration).toContain("a.status::TEXT IN ('planned', 'confirmed', 'scheduled', 'entwurf', 'geplant')");
    expect(migration).toContain("started_visit.execution_status::TEXT <> 'pending'");
    expect(migration).toContain('started_visit.actual_start_at IS NOT NULL');
    expect(migration).toContain('started_visit.on_the_way_at IS NOT NULL');
    expect(migration).toContain('started_visit.arrived_at IS NOT NULL');
    expect(migration).toContain('started_visit.finished_at IS NOT NULL');
  });

  it('synchronisiert Zuordnung, Assist-Einsatz und alle zugehörigen Kalenderquellen', () => {
    expect(migration).toContain('UPDATE public.assignments a');
    expect(migration).toContain('UPDATE public.assist_visits v');
    expect(migration).toContain('UPDATE public.calendar_events event');
    expect(migration).toContain('event.source_id = target.assignment_id');
    expect(migration).toContain('source_visit.id = event.source_id');
    expect(migration).toContain("'durationRepairRelease', 'R34'");
  });

  it('schützt die Profilzeit auch bei späteren Zeitfeld-Updates', () => {
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF assignment_profile_id, planned_start_at, planned_end_at',
    );
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF legacy_assignment_id, planned_start_at, planned_end_at, duration_minutes',
    );
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF module_key, source_type, source_id, start_at, end_at',
    );
  });

  it('protokolliert die Korrektur ohne Daten zu löschen', () => {
    expect(migration).toContain("'profile_duration_complete_future_repair'");
    expect(migration).toContain("'System · R34'");
    expect(migration).toContain('BEGIN;');
    expect(migration).toContain('COMMIT;');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/TRUNCATE\s+/i);
    expect(migration).not.toMatch(/DROP\s+TABLE\s+public\./i);
  });
});
