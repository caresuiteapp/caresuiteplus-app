import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ASSIGNMENT_BEZEICHNUNG_OPTIONS,
  DEFAULT_ASSIGNMENT_BEZEICHNUNG,
} from '@/lib/assist/assignmentBezeichnungOptions';
import {
  buildDefaultTaskSelections,
  isTaskSelected,
  toggleTaskSelection,
} from '@/lib/assist/assignmentCreateFormHelpers';
import { fetchAssignmentEmployeeList } from '@/lib/assist/assignmentEmployeeListService';
import { fetchClientTasks } from '@/lib/clients/clientTasksService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type { ClientTask } from '@/types/modules/client';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function makeTask(overrides: Partial<ClientTask> & Pick<ClientTask, 'id' | 'title'>): ClientTask {
  return {
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    category: 'begleitung',
    description: null,
    frequency: 'woechentlich',
    durationMinutes: 30,
    isActive: true,
    catalogTaskId: null,
    assignedEmployeeIds: [],
    moduleKey: 'assist',
    leistungsbereich: 'alltagsbegleitung',
    subcategory: 'aktivierung',
    packageId: null,
    leistungsart: null,
    isMandatory: false,
    proofRequired: false,
    documentationRequired: true,
    billingRelevant: true,
    visibleToClient: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('Assignment create form', () => {
  it('definiert 10 feste Bezeichnungs-Optionen für Assist', () => {
    expect(ASSIGNMENT_BEZEICHNUNG_OPTIONS).toHaveLength(10);
    expect(ASSIGNMENT_BEZEICHNUNG_OPTIONS).toContain('Alltagsbegleitung');
    expect(ASSIGNMENT_BEZEICHNUNG_OPTIONS).toContain('Erstbesuch / Kontrollbesuch');
    expect(DEFAULT_ASSIGNMENT_BEZEICHNUNG).toBe('Alltagsbegleitung');
  });

  it('AssignmentCreateScreen nutzt Bezeichnungs-Optionen und Klienten-Aufgaben', () => {
    const screen = readSrc('src/screens/assist/AssignmentCreateScreen.tsx');
    expect(screen).toContain('ASSIGNMENT_BEZEICHNUNG_OPTIONS');
    expect(screen).toContain('fetchClientTasks');
    expect(screen).toContain('buildDefaultTaskSelections');
    expect(screen).not.toContain('Weitere Aufgabe');
    expect(screen).not.toContain('onChangeText={(title)');
  });

  it('übernimmt aktive Aufgaben aus der Klientenakte als Vorauswahl', () => {
    const tasks = [
      makeTask({ id: 'task-a', title: 'Staubsaugen', isActive: true }),
      makeTask({ id: 'task-b', title: 'Archiviert', isActive: false }),
      makeTask({ id: 'task-c', title: 'Spaziergang', isActive: true }),
    ];

    const selected = buildDefaultTaskSelections(tasks);
    expect(selected).toHaveLength(2);
    expect(selected.map((entry) => entry.title)).toEqual(['Staubsaugen', 'Spaziergang']);
  });

  it('erlaubt Aufgaben abzuwählen und wieder auszuwählen', () => {
    const task = makeTask({ id: 'task-a', title: 'Einkauf' });
    const initial = buildDefaultTaskSelections([task]);
    const deselected = toggleTaskSelection(initial, task);
    expect(deselected).toHaveLength(0);
    const reselected = toggleTaskSelection(deselected, task);
    expect(isTaskSelected(reselected, task.id)).toBe(true);
  });

  it('lädt Demo-Aufgaben beim Klientenwechsel', async () => {
    const result = await fetchClientTasks(DEMO_TENANT_ID, 'client-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((task) => task.isActive)).toBe(true);
    const selected = buildDefaultTaskSelections(result.data);
    expect(selected.length).toBeGreaterThan(0);
  });

  it('fetchAssignmentEmployeeList liefert einsatzfähige Demo-Mitarbeitende', async () => {
    const result = await fetchAssignmentEmployeeList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((employee) => employee.firstName.length > 0)).toBe(true);
  });
});
