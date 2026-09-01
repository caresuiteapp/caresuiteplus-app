import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildAssistGpsRecoveryLegWindows,
  isAssistTrackingSessionEffectivelyActive,
  type AssistGpsRecoveryPoint,
} from '@/lib/employeeLogbook/employeeLogbookGpsSegmentation';

const read = (file: string) => readFileSync(file, 'utf8');

function point(latitude: number, longitude: number, recordedAt: string): AssistGpsRecoveryPoint {
  return {
    latitude,
    longitude,
    accuracy: 8,
    altitude: null,
    speed: null,
    heading: null,
    recordedAt,
  };
}

describe('Fahrtenbuch P0 R18.4 · veraltete Aufzeichnungen und echte Fahrtabschnitte', () => {
  it('behandelt ein altes is_active ohne frischen Heartbeat und GPS-Punkt nicht als live', () => {
    const nowMs = Date.parse('2026-09-01T12:00:00.000Z');
    expect(isAssistTrackingSessionEffectivelyActive({
      storedActive: true,
      sessionUpdatedAt: '2026-08-26T09:00:00.000Z',
      lastPointAt: '2026-08-26T08:59:00.000Z',
      visitClosed: false,
      nowMs,
    })).toBe(false);
    expect(isAssistTrackingSessionEffectivelyActive({
      storedActive: true,
      sessionUpdatedAt: '2026-09-01T11:56:00.000Z',
      lastPointAt: '2026-09-01T11:55:00.000Z',
      visitClosed: false,
      nowMs,
    })).toBe(true);
  });

  it('trennt die Anfahrt von einer späteren Fahrt während des Einsatzes', () => {
    const points = [
      point(51.5000, 7.1000, '2026-09-01T06:00:00.000Z'),
      point(51.5050, 7.1100, '2026-09-01T06:02:00.000Z'),
      point(51.5100, 7.1200, '2026-09-01T06:04:00.000Z'),
      point(51.5100, 7.1200, '2026-09-01T06:20:00.000Z'),
      point(51.5150, 7.1300, '2026-09-01T06:22:00.000Z'),
      point(51.5200, 7.1400, '2026-09-01T06:24:00.000Z'),
    ];
    const legs = buildAssistGpsRecoveryLegWindows({
      sessionId: 'session-1',
      points,
      events: [
        { eventType: 'drive_start', occurredAt: '2026-09-01T06:00:00.000Z' },
        { eventType: 'drive_end', occurredAt: '2026-09-01T06:04:00.000Z' },
        { eventType: 'service_start', occurredAt: '2026-09-01T06:05:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-09-01T06:30:00.000Z' },
      ],
      fallbackEndedAt: '2026-09-01T06:30:00.000Z',
    });
    expect(legs.map((leg) => leg.kind)).toEqual(['approach', 'service_drive']);
    expect(legs[0].points.at(-1)?.recordedAt).toBe('2026-09-01T06:04:00.000Z');
    expect(legs[1].points[0]?.recordedAt).toBe('2026-09-01T06:20:00.000Z');
  });

  it('bewahrt einen Ortswechsel während einer langen GPS-Lücke als eigenen Prüfabschnitt', () => {
    const legs = buildAssistGpsRecoveryLegWindows({
      sessionId: 'session-gap',
      points: [
        point(51.5000, 7.1000, '2026-09-01T06:00:00.000Z'),
        point(51.5050, 7.1100, '2026-09-01T06:02:00.000Z'),
        point(51.6500, 7.2500, '2026-09-01T07:10:00.000Z'),
        point(51.6550, 7.2600, '2026-09-01T07:12:00.000Z'),
      ],
      events: [],
      fallbackEndedAt: '2026-09-01T07:12:00.000Z',
    });
    const gapLegs = legs.filter((leg) => leg.id.startsWith('gps-gap-'));
    expect(gapLegs).toHaveLength(1);
    expect(gapLegs[0].points).toHaveLength(2);
    expect(gapLegs[0].purposePrefix).toContain('Zuordnung erforderlich');
  });

  it('schneidet Rück- oder Weiterfahrten nach dem Einsatzende nicht ab', () => {
    const legs = buildAssistGpsRecoveryLegWindows({
      sessionId: 'session-return',
      points: [
        point(51.5000, 7.1000, '2026-09-01T08:00:00.000Z'),
        point(51.5000, 7.1000, '2026-09-01T08:30:00.000Z'),
        point(51.5050, 7.1100, '2026-09-01T08:32:00.000Z'),
        point(51.5100, 7.1200, '2026-09-01T08:34:00.000Z'),
      ],
      events: [
        { eventType: 'service_start', occurredAt: '2026-09-01T08:00:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-09-01T08:20:00.000Z' },
        { eventType: 'depart', occurredAt: '2026-09-01T08:30:00.000Z' },
      ],
      fallbackEndedAt: '2026-09-01T08:34:00.000Z',
    });
    const departure = legs.find((leg) => leg.id.startsWith('departure-'));
    expect(departure?.points.map((item) => item.recordedAt)).toEqual([
      '2026-09-01T08:30:00.000Z',
      '2026-09-01T08:32:00.000Z',
      '2026-09-01T08:34:00.000Z',
    ]);
    expect(departure?.purposePrefix).toContain('Rück- oder Weiterfahrt');
  });

  it('verhindert eine Wiederaufnahme alter Fahrten im Mitarbeitendenportal', () => {
    const automation = read('src/lib/employeeLogbook/employeeLogbookAutomation.ts');
    expect(automation).toContain('berlinDateKey(active.startedAt) < berlinToday()');
    expect(automation).toContain('await stopNativeBackgroundTracking()');
    expect(automation).toContain('return null');
  });

  it('sperrt alte R16-Gesamtimporte und offene Vortagsfahrten revisionssicher', () => {
    const migration = read('supabase/migrations/20260901160000_employee_logbook_stale_segmentation_r18_4.sql');
    expect(migration).toContain("'recording','review_required','completed'");
    expect(migration).toContain("source LIKE 'assist_gps_recovery:%'");
    expect(migration).toContain("source = 'employee_portal'");
    expect(migration).toContain("started_at >= TIMESTAMPTZ '2026-08-24");
    expect(migration).toContain("status = 'review_required'");
    expect(migration).toContain("end_reason = 'timeout'");
    expect(migration).toContain('AND NOT EXISTS (');
    expect(migration).toContain('FROM public.employee_expense_claims protected_claim');
    expect(migration).not.toContain('UPDATE public.employee_expense_claims');
    expect(migration).not.toContain("SET status = 'rejected'");
  });

  it('stellt Sitzungen und Fahrtabschnitte einzeln dar und sperrt unklare Zwecke', () => {
    const recovery = read('src/lib/employeeLogbook/employeeLogbookAssistGpsRecovery.ts');
    const panel = read('src/components/office/EmployeeLogbookOfficePanel.tsx');
    expect(recovery).toContain("'assist_time_events'");
    expect(recovery).toContain('assist_gps_recovery_r18:');
    expect(recovery).toContain("reviewRequired: window.kind !== 'approach'");
    expect(recovery).toContain("leg.reviewRequired ? 'review_required' : 'completed'");
    expect(panel).toContain('erkannte Fahrtabschnitte');
    expect(panel).toContain('VERALTET · BEENDET');
    expect(panel).toContain('PRÜFUNG NÖTIG');
    expect(panel).toContain("trip.status === 'review_required' ? '—'");
  });
});
