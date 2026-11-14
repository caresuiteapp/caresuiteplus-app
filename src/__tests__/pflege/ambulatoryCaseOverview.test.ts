import { describe, expect, it, vi } from 'vitest';
import { buildAmbulatoryCaseOverview, filterAmbulatoryCases, readCaseOverviewSource, type OverviewSources } from '@/lib/pflege/ambulatoryCaseOverview';

const first = '00000000-0000-0000-0000-000000000001';
const second = '00000000-0000-0000-0000-000000000002';
const plan = '00000000-0000-0000-0000-000000000003';
const clients = [
  { id: second, firstName: 'Léa', lastName: 'Müller', careLevel: null, dateOfBirth: null },
  { id: first, firstName: 'Theo', lastName: 'Groẞ', careLevel: '3', dateOfBirth: null },
];
const sources = {
  operations: { state: 'ready', data: {
    admissions: [{ id: 'admission', clientId: first, status: 'active', updatedAt: '2026-11-12' }, { id: 'old', clientId: first, status: 'closed', updatedAt: '2026-11-13' }],
    tasks: [{ clientId: first, status: 'open', dueOn: '2026-11-13' }, { clientId: first, status: 'open', dueOn: '2026-11-14' }, { clientId: first, status: 'open', dueOn: '' }, { clientId: second, status: 'done', dueOn: '2026-11-13' }],
  } },
  plans: { state: 'ready', data: [{ id: plan, clientId: first, status: 'aktiv' }] },
  assessments: { state: 'ready', data: [{ subjectId: second }] },
  orders: { state: 'restricted' },
  proofs: { state: 'unavailable' },
  billing: { state: 'ready', data: [{ clientId: second, status: 'ready' }] },
} satisfies OverviewSources;

describe('Versorgungsübersicht', () => {
  it('binds results, plan targets and due dates to the correct case, distinguishes unconfirmed data from real zeros', () => {
    const [a, b] = buildAmbulatoryCaseOverview(clients, sources, '2026-11-14');
    expect(a).toMatchObject({ id: first, admission: { value: 'active' }, openTasks: { value: { open: 3, overdue: 1 } }, plan: { value: { onlyId: plan } }, proof: { state: 'unavailable' }, order: { state: 'restricted' }, assessment: { value: 0 } });
    expect(b).toMatchObject({ id: second, admission: { value: 'missing' }, plan: { value: { onlyId: null } }, openTasks: { value: { open: 0, overdue: 0 } }, bill: { value: { blocked: 0, ready: 1 } } });
    expect(filterAmbulatoryCases([a, b], ' LEA, muller  ', 'all').map(row => row.id)).toEqual([second]);
    expect(filterAmbulatoryCases([a, b], 'gross', 'active').map(row => row.id)).toEqual([first]);
    expect(filterAmbulatoryCases([a, b], '', 'attention').map(row => row.id)).toEqual([first, second]);
  });

  it('does not classify a failed workflow source as an absent admission or completed work', () => {
    const rows = buildAmbulatoryCaseOverview(clients, { ...sources, operations: { state: 'unavailable' } }, '2026-11-14');
    expect(filterAmbulatoryCases(rows, '', 'attention')).toEqual([]);
    expect(filterAmbulatoryCases(rows, '', 'active')).toEqual([]);
    expect(rows[0].admission).toEqual({ state: 'unavailable' });
  });

  it('does not start a withheld read or return rows after the current grant disappears', async () => {
    const read = vi.fn(async () => ({ ok: true as const, data: [first] }));
    await expect(readCaseOverviewSource(() => false, read)).resolves.toEqual({ state: 'restricted' });
    expect(read).not.toHaveBeenCalled();
    let allowed = true;
    await expect(readCaseOverviewSource(() => allowed, async () => {
      const value = await read();
      allowed = false;
      return value;
    })).resolves.toEqual({ state: 'restricted' });
  });

  it('isolates failed, truncated and fallback reads from other case sources', async () => {
    await expect(readCaseOverviewSource(() => true, async () => { throw Error('connection failed'); })).resolves.toEqual({ state: 'unavailable' });
    await expect(readCaseOverviewSource(() => true, async () => ({ ok: true as const, data: [first], usedDemoFallback: true }))).resolves.toEqual({ state: 'unavailable' });
    await expect(readCaseOverviewSource(() => true, async () => ({ ok: true as const, data: [first] }), rows => rows.length === 1)).resolves.toEqual({ state: 'unavailable' });
    await expect(readCaseOverviewSource(() => true, async () => ({ ok: true as const, data: [] }))).resolves.toEqual({ state: 'ready', data: [] });
  });
});
