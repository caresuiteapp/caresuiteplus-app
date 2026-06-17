import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createClientTask,
  deleteClientTask,
  fetchClientTasks,
  updateClientTask,
} from '@/lib/clients/clientTasksService';

const root = path.join(__dirname, '..', '..', '..');

describe('ClientTasksPanel wiring', () => {
  it('ClientRecordTabPanels routes Aufgaben tab to ClientTasksPanel', () => {
    const tabPanels = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordTabPanels.tsx'),
      'utf8',
    );
    const tasksPanel = readFileSync(
      path.join(root, 'src/components/office/ClientTasksPanel.tsx'),
      'utf8',
    );

    expect(tabPanels).toContain("tab === 'aufgaben'");
    expect(tabPanels).toContain('ClientRecordTasksPanel');
    expect(tabPanels).not.toContain('EinsatzAufgabenTab');
    expect(tasksPanel).toContain('Aufgabe manuell hinzufügen');
    expect(tasksPanel).toContain('Aus Katalog hinzufügen');
    expect(tasksPanel).toContain('CareSuite+ Assist');
    expect(tasksPanel).not.toContain('clientEditRoute');
  });

  it('ClientRecordTabPanels routes Einsätze tab to ClientRecordShiftsPanel', () => {
    const tabPanels = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordTabPanels.tsx'),
      'utf8',
    );
    const shiftsPanel = readFileSync(
      path.join(root, 'src/components/office/ClientRecordShiftsPanel.tsx'),
      'utf8',
    );

    expect(tabPanels).toContain("tab === 'einsaetze'");
    expect(tabPanels).toContain('ClientRecordShiftsTabPanel');
    expect(tabPanels).toContain('ClientRecordShiftsPanel');
    expect(tabPanels).not.toMatch(/einsaetze[\s\S]{0,120}ClientRecordTasksPanel/);
    expect(shiftsPanel).toContain('title="Einsätze"');
    expect(shiftsPanel).toContain('Keine Einsätze');
    expect(shiftsPanel).toContain('Noch keine Einsätze geplant');
    expect(shiftsPanel).not.toContain('Keine Aufgaben definiert');
    expect(shiftsPanel).toContain('Einsatzpräferenzen');
  });

  it('hero edit action is labeled Stammdaten bearbeiten', () => {
    const hero = readFileSync(path.join(root, 'src/components/office/ClientRecordHero.tsx'), 'utf8');
    const screen = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordScreen.tsx'),
      'utf8',
    );

    expect(hero).toContain('Stammdaten bearbeiten');
    expect(screen).toContain('Stammdaten bearbeiten');
  });

  it('repository exposes updateTask and deleteTask for live mode', () => {
    const repo = readFileSync(
      path.join(root, 'src/lib/clients/repositories/clientExtendedRepository.supabase.ts'),
      'utf8',
    );
    expect(repo).toContain('async updateTask');
    expect(repo).toContain('async deleteTask');
    expect(repo).toContain("'client_tasks'");
  });
});

describe('Client tasks service (demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates, updates and deletes tasks for demo client', async () => {
    const created = await createClientTask(DEMO_TENANT_ID, 'client-001', {
      category: 'haushalt',
      title: 'Testaufgabe Heinz-Peter',
      description: 'Fenster putzen',
      frequency: 'woechentlich',
      durationMinutes: 30,
      isActive: true,
      catalogTaskId: null,
      assignedEmployeeIds: [],
      moduleKey: 'assist',
      leistungsbereich: null,
      subcategory: null,
      packageId: null,
      leistungsart: null,
      isMandatory: false,
      proofRequired: false,
      documentationRequired: true,
      billingRelevant: true,
      visibleToClient: true,
    });
    expect(created.ok).toBe(true);

    const list = await fetchClientTasks(DEMO_TENANT_ID, 'client-001');
    expect(list.ok).toBe(true);
    if (!list.ok) return;

    const task = list.data.find((entry) => entry.title === 'Testaufgabe Heinz-Peter');
    expect(task).toBeTruthy();
    if (!task) return;

    const updated = await updateClientTask(DEMO_TENANT_ID, 'client-001', task.id, {
      title: 'Testaufgabe aktualisiert',
      isActive: false,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.title).toBe('Testaufgabe aktualisiert');
      expect(updated.data.isActive).toBe(false);
    }

    const deleted = await deleteClientTask(DEMO_TENANT_ID, 'client-001', task.id);
    expect(deleted.ok).toBe(true);
  });
});
