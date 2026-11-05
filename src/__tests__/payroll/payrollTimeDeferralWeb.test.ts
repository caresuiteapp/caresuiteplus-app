import { describe, expect, it } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { deferredPayrollEntry, matchDeferredPayrollEntry, payrollTimeRegistry, resolvePayrollCatchUp } from '@/lib/payroll/payrollTimeDeferral.web';

const now = Date.parse('2026-12-10T12:00:00Z');
const entry = (patch: Partial<WfmOfficeTimeEntry> = {}) => ({ id: 'source-1', employeeId: 'e1', workDate: '2026-10-12', assignmentId: 'series', visitId: null, sessionId: null,
  plannedStartAt: '2026-10-12T08:00:00Z', plannedEndAt: '2026-10-12T10:00:00Z', actualStartAt: '2026-10-12T08:00:00Z', actualEndAt: '2026-10-12T10:00:00Z',
  netMinutes: 110, pauseMinutes: 10, travelMinutes: 0, source: 'portal', reviewStatus: 'approved', rowKind: 'planned_with_actual', flags: [], assignmentTitle: 'Begleitung', clientLabel: null, ...patch } as WfmOfficeTimeEntry);
const pending = (patch: Partial<WfmOfficeTimeEntry> = {}) => deferredPayrollEntry(entry(patch), 'unapproved');
const history = (deferred = [pending()], patch: Record<string, unknown> = {}) => ({ employee_id: 'e1', period_year: 2026, period_month: 10, version: 1, status: 'published', snapshot_json: { deferredTimeEntries: deferred }, ...patch });

describe('deferred payroll sources across publication periods', () => {
  it('uses only an approved complete capture, preserves the work date and never estimates planned minutes', () => {
    const registry = payrollTimeRegistry([history()], 'e1');
    for (const changed of [entry({ reviewStatus: 'pending_review' }), entry({ actualEndAt: null }), entry({ actualStartAt: null, actualEndAt: null, rowKind: 'planned_missing_actual' }), entry({ reviewStatus: 'rejected' })]) {
      const result = resolvePayrollCatchUp(registry, [changed], 2026, 11, now);
      expect(result.catchUp).toEqual([]); expect(result.pending).toHaveLength(1);
    }
    const result = resolvePayrollCatchUp(registry, [entry()], 2026, 11, now);
    expect(result.pending).toEqual([]); expect(result.catchUp).toEqual([expect.objectContaining({ sourceEntryId: 'source-1', workDate: '2026-10-12', minutes: 110 })]);
    expect(resolvePayrollCatchUp(registry, [entry()], 2026, 10, now).catchUp).toEqual([]);
  });
  it('matches a corrected planned placeholder to a unique occurrence without merging repeated visits', () => {
    const placeholder = pending({ id: 'planned-only', actualStartAt: null, actualEndAt: null });
    expect(matchDeferredPayrollEntry(placeholder, [entry()])?.id).toBe('source-1');
    expect(matchDeferredPayrollEntry(placeholder, [entry(), entry({ id: 'second' })])).toBeUndefined();
    expect(matchDeferredPayrollEntry(placeholder, [entry({ plannedStartAt: '2026-10-12T12:00:00Z' })])).toBeUndefined();
    expect(matchDeferredPayrollEntry(pending(), [entry({ id: 'other', workDate: '2026-10-13' })])).toBeUndefined();
  });
  it('settles an actual source once even when two pending aliases resolve to it', () => {
    const registry = payrollTimeRegistry([history([pending(), pending({ id: 'planned-only' })])], 'e1');
    const result = resolvePayrollCatchUp(registry, [entry()], 2026, 11, now);
    expect(result.catchUp).toHaveLength(1); expect(result.catchUp[0].minutes).toBe(110); expect(result.pending).toHaveLength(1);
  });
  it('resolves distinct deferred visits in the same daily session exactly once each', () => {
    const first = entry({ sessionId: 'shared-session', visitId: 'visit-1' });
    const second = entry({ id: 'source-2', sessionId: 'shared-session', visitId: 'visit-2', assignmentId: 'second-assignment' });
    const registry = payrollTimeRegistry([history([deferredPayrollEntry(first, 'incomplete'), deferredPayrollEntry(second, 'incomplete')])], 'e1');
    expect(matchDeferredPayrollEntry(deferredPayrollEntry(first, 'incomplete'), [first, second])).toBe(first);
    expect(matchDeferredPayrollEntry(deferredPayrollEntry(second, 'incomplete'), [first, second])).toBe(second);
    expect(resolvePayrollCatchUp(registry, [first, second], 2026, 11, now).catchUp.map(item => item.sourceEntryId)).toEqual(['source-1', 'source-2']);
    expect(matchDeferredPayrollEntry(deferredPayrollEntry(first, 'incomplete'), [second])).toBeUndefined();
  });
  it('matches occurrence aliases before session identity and keeps standalone work separate', () => {
    const first = entry({ sessionId: 'shared-session', visitId: 'visit-1' });
    const second = entry({ id: 'source-2', sessionId: 'shared-session', visitId: 'visit-2', assignmentId: 'second-assignment' });
    const alias = deferredPayrollEntry({ ...first, id: 'planned-placeholder' }, 'missing');
    expect(matchDeferredPayrollEntry(alias, [first, second])).toBe(first);
    const standalone = entry({ id: 'session:shared-session', sessionId: 'shared-session', visitId: null, assignmentId: null });
    const oldStandalone = deferredPayrollEntry({ ...standalone, id: 'old-session-alias' }, 'incomplete');
    expect(matchDeferredPayrollEntry(oldStandalone, [first, standalone])).toBe(standalone);
    expect(matchDeferredPayrollEntry(oldStandalone, [first])).toBeUndefined();
    expect(matchDeferredPayrollEntry(alias, [first, { ...first, id: 'duplicate-source' }, second])).toBeUndefined();
  });
  it('retains frozen claims on reissue and excludes them from every other month, including older reopened periods', () => {
    const origin = history();
    const claimed = resolvePayrollCatchUp(payrollTimeRegistry([origin], 'e1'), [entry()], 2026, 12, now).catchUp;
    const registry = payrollTimeRegistry([origin, history([], { period_month: 12, snapshot_json: { catchUpTimeEntries: claimed } })], 'e1');
    expect(resolvePayrollCatchUp(registry, [entry({ netMinutes: 115 })], 2026, 12, now).catchUp).toEqual(claimed);
    expect(resolvePayrollCatchUp(registry, [entry()], 2026, 11, now)).toEqual({ catchUp: [], pending: [] });
    expect(resolvePayrollCatchUp(registry, [entry()], 2027, 1, now)).toEqual({ catchUp: [], pending: [] });
  });
  it('keeps deferrals from superseded versions, ignores drafts and other employees, and rejects corrupt history', () => {
    expect(payrollTimeRegistry([history([], { version: 2 }), history([pending()], { status: 'superseded' })], 'e1').deferred.size).toBe(1);
    expect(payrollTimeRegistry([history([pending()], { status: 'draft' }), history([pending()], { employee_id: 'e2' })], 'e1').deferred.size).toBe(0);
    expect(() => payrollTimeRegistry([history([{ ...pending(), key: 'invalid' }])], 'e1')).toThrow('Herkunft');
  });
});
