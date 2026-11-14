import { describe, expect, it } from 'vitest';
import type { CareAdmission, CareTask } from '@/lib/pflege/ambulatoryOperationsDomain';
import { filterAdmissions, filterCareTasks, operationsCaseScope, operationsQueueRoute, validateOperationAction } from '@/lib/pflege/ambulatoryOperationsQueue';

const first = '55555555-5555-4555-8555-555555555555';
const second = '66666666-6666-4666-8666-666666666666';
const version = '2026-11-14T09:00:00Z';
const name = (id: string) => id === first ? 'Marie Müller' : 'Rita Groß';
const employeeName = (id: string) => id === 'nurse' ? 'Sabine König' : '';
const today = '2026-11-14';
const admission = (id: string, patch: Partial<CareAdmission> = {}): CareAdmission => ({
  id, clientId: first, clientName: '', status: 'draft', startsOn: today, endsOn: '', basis: 'sgb_xi', payerName: 'Testkasse', payerIk: '123456789',
  contractReference: 'Pflegevertrag', costInformationReference: 'Preisinformation', consentReference: '', emergencyContact: '', accessNotes: '', notes: '', updatedAt: version, ...patch,
});
const task = (id: string, patch: Partial<CareTask> = {}): CareTask => ({
  id, clientId: first, title: 'Angehörige zurückrufen', description: 'Bestätigung erfragen', status: 'open', dueOn: today, priority: 'normal', resolution: '', assignedEmployeeId: '', updatedAt: version, ...patch,
});

describe('Aufnahme- und Aufgabenbestand', () => {
  it('preserves case selection across queues and never treats malformed or multiple params as all cases', () => {
    expect(operationsCaseScope(first, 'admissions')).toEqual({ state: 'case', clientId: first });
    expect(operationsCaseScope(undefined, 'tasks')).toEqual({ state: 'all' });
    expect(operationsCaseScope([first, second], 'tasks')).toEqual({ state: 'invalid' });
    expect(operationsCaseScope('', 'admissions')).toEqual({ state: 'invalid' });
    expect(operationsQueueRoute('tasks', first)).toBe(`/pflege/aufgaben?clientId=${first}`);
    expect(operationsQueueRoute('admissions', first)).toBe(`/pflege/aufnahme?clientId=${first}`);
    expect(operationsQueueRoute('tariffs', first)).toBe('/pflege/leistungskatalog');
  });

  it('shows only complete drafts as ready, and can find a case with an accent-insensitive name and payer search', () => {
    const rows = [admission('ready'), admission('missing', { contractReference: '' }), admission('other', { clientId: second }), admission('active', { status: 'active' })];
    expect(filterAdmissions(rows, { filter: 'ready', search: 'muller, testkasse', caseId: first, name }).map(row => row.id)).toEqual(['ready']);
    expect(filterAdmissions(rows, { filter: 'active', search: '', caseId: second, name })).toEqual([]);
  });

  it('sorts open tasks by valid due date and priority and does not count completed, invalid dates or other cases as overdue', () => {
    const rows = [
      task('today-normal'), task('today-urgent', { priority: 'urgent', assignedEmployeeId: 'nurse' }),
      task('bad-date', { dueOn: '' }), task('old', { dueOn: '2026-11-13' }), task('foreign', { clientId: second, dueOn: '2026-11-13' }),
      task('done', { status: 'done', dueOn: '2026-11-12' }),
    ];
    const options = { caseId: first, search: '', today, name, employeeName };
    expect(filterCareTasks(rows, { ...options, filter: 'open' }).map(row => row.id)).toEqual(['old', 'today-urgent', 'today-normal', 'bad-date']);
    expect(filterCareTasks(rows, { ...options, filter: 'overdue' }).map(row => row.id)).toEqual(['old']);
    expect(filterCareTasks(rows, { ...options, filter: 'today', search: 'konig' }).map(row => row.id)).toEqual(['today-urgent']);
    expect(filterCareTasks(rows, { ...options, filter: 'unassigned' }).map(row => row.id)).toEqual(['old', 'today-normal', 'bad-date']);
  });

  it('validates case, version, allowed transition and case-specific reasons before attempting a write', () => {
    const rows = { admissions: [admission('a', { costInformationReference: '' })], tasks: [task('t')] };
    const finish = { kind: 'task', id: 't', status: 'done', version } as const;
    expect(validateOperationAction(finish, rows, first, '   ')).toMatch(/Ergebnis/);
    expect(validateOperationAction(finish, rows, first, 'Rückruf bestätigt')).toBeNull();
    expect(validateOperationAction(finish, rows, second, 'Rückruf bestätigt')).toMatch(/geändert/);
    expect(validateOperationAction({ ...finish, version: 'alter Stand' }, rows, first, 'Rückruf bestätigt')).toMatch(/geändert/);
    expect(validateOperationAction({ kind: 'admission', id: 'a', status: 'active', version }, rows, first, '')).toMatch(/Kosteninformation/);
    expect(validateOperationAction({ kind: 'admission', id: 'a', status: 'closed', version }, rows, first, '')).toMatch(/Begründung/);
    expect(validateOperationAction({ kind: 'admission', id: 'a', status: 'paused', version }, rows, first, 'Aufenthalt')).toMatch(/nicht mehr geändert/);
  });
});
