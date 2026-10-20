import { describe, expect, it } from 'vitest';
import {
  assertHealthOSDisplayLabel,
  resolveAssignmentStatusDisplay,
  resolveBlockerStatusDisplay,
  resolveBudgetStatusDisplay,
  resolveDocumentStatusDisplay,
  resolveHealthOSStatusDisplay,
  resolveWfmStatusDisplay,
} from '@/components/healthos/status/healthosStatusMapping';

describe('HealthOS status mapping', () => {
  it('maps assignment statuses to German labels', () => {
    expect(resolveAssignmentStatusDisplay('dokumentation_offen').label).toBe('Dokumentation offen');
    expect(resolveAssignmentStatusDisplay('abgeschlossen').tone).toBe('green');
  });

  it('maps budget lifecycle to German labels', () => {
    expect(resolveBudgetStatusDisplay('durchgefuehrt').label).toBe('Durchgeführt');
    expect(resolveBudgetStatusDisplay('geplant').label).toBe('Vorschau');
  });

  it('maps WFM session statuses to German labels', () => {
    expect(resolveWfmStatusDisplay('clocked_in').label).toBe('Aktiv');
    expect(resolveWfmStatusDisplay('on_visit').label).toBe('Im Einsatz');
  });

  it('maps document lifecycle to German labels', () => {
    expect(resolveDocumentStatusDisplay('finalized').label).toBe('Finalisiert');
    expect(resolveDocumentStatusDisplay('draft').label).toBe('Entwurf');
  });

  it('maps blocker codes to German labels', () => {
    expect(resolveBlockerStatusDisplay('wfm_sync_failed').label).toBe(
      'Zeitkonto-Sync fehlgeschlagen',
    );
    expect(resolveBlockerStatusDisplay('budget_reservation_failed').severity).toBe('error');
  });

  it('does not expose raw technical keys for known assignment values', () => {
    const technical = 'unterschrift_offen';
    const resolved = resolveHealthOSStatusDisplay('assignment', technical);
    expect(resolved.label).not.toBe(technical);
    expect(resolved.label).toBe('Unterschrift offen');
    expect(() => assertHealthOSDisplayLabel('assignment', technical)).not.toThrow();
  });

  it('returns fallback for unknown technical values', () => {
    expect(resolveHealthOSStatusDisplay('wfm', 'not_a_real_status').label).toBe('Status unbekannt');
  });

  it('assertHealthOSDisplayLabel passes for mapped values', () => {
    expect(() => assertHealthOSDisplayLabel('budget', 'durchgefuehrt')).not.toThrow();
  });

  it('fallback label never equals raw technical key for unknown values', () => {
    const technical = 'not_a_real_status';
    const resolved = resolveHealthOSStatusDisplay('wfm', technical);
    expect(resolved.label).not.toBe(technical);
    expect(resolved.label).toBe('Status unbekannt');
  });
});
