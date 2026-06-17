import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASSIST_CATALOG_TASKS,
  ASSIST_TASK_PACKAGES,
  getAssistTasksByPackage,
} from '@/data/assist/assistTaskCatalog';
import {
  addAssistPackageToClient,
  catalogTaskToClientTaskInput,
  getAssistTaskPackages,
} from '@/lib/assist/assistTaskCatalogService';
import {
  isForbiddenAssistTask,
  validateAssistTaskTitle,
} from '@/lib/assist/assistTaskGuardService';
import {
  ASSIST_LEISTUNGSBEREICH_KEYS,
  ASSIST_NOT_COMPLETED_REASON_KEYS,
  ASSIST_SUBCATEGORY_KEYS,
  ASSIST_TAGESFORM_KEYS,
} from '@/types/modules/assist/assistTaskCatalog';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { fetchClientTasks } from '@/lib/clients/clientTasksService';

describe('Assist task catalog structure', () => {
  it('defines 7 predefined packages with tasks', () => {
    expect(getAssistTaskPackages()).toHaveLength(7);
    expect(ASSIST_TASK_PACKAGES.map((p) => p.key)).toEqual([
      'standard-alltagsbegleitung',
      'demenzbetreuung',
      'hauswirtschaft-gross',
      'einkaufsservice',
      'arztbegleitung',
      'spaziergang-teilhabe',
      'angehoerigenentlastung',
    ]);

    for (const pkg of ASSIST_TASK_PACKAGES) {
      const tasks = getAssistTasksByPackage(pkg.id);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.packageId === pkg.id)).toBe(true);
    }
  });

  it('covers all 6 Leistungsbereiche and 16 subcategories', () => {
    const bereiche = new Set(ASSIST_CATALOG_TASKS.map((t) => t.leistungsbereich));
    for (const key of ASSIST_LEISTUNGSBEREICH_KEYS) {
      expect(bereiche.has(key)).toBe(true);
    }

    const subcategories = new Set(ASSIST_CATALOG_TASKS.map((t) => t.subcategory));
    expect(subcategories.size).toBeGreaterThanOrEqual(10);
    for (const key of ASSIST_SUBCATEGORY_KEYS) {
      expect(subcategories.has(key) || key === 'eskalationen').toBeTruthy();
    }
  });

  it('maps catalog tasks to client task input with assist metadata', () => {
    const template = ASSIST_CATALOG_TASKS[0];
    const result = catalogTaskToClientTaskInput(template.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.moduleKey).toBe('assist');
    expect(result.data.leistungsbereich).toBe(template.leistungsbereich);
    expect(result.data.subcategory).toBe(template.subcategory);
    expect(result.data.packageId).toBe(template.packageId);
    expect(result.data.catalogTaskId).toBe(template.id);
  });
});

describe('Assist forbidden task detection', () => {
  it('blocks medical care tasks in Assist module', () => {
    expect(isForbiddenAssistTask('Medikamente verabreichen')).toBe(true);
    expect(isForbiddenAssistTask('Insulin spritzen')).toBe(true);
    expect(isForbiddenAssistTask('Wundversorgung')).toBe(true);
    expect(isForbiddenAssistTask('Diagnose stellen')).toBe(true);

    const result = validateAssistTaskTitle('Medikamentengabe', 'Morgenmedikation');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Assist');
    }
  });

  it('allows assist-typical tasks', () => {
    expect(isForbiddenAssistTask('Tagesform erfragen')).toBe(false);
    expect(isForbiddenAssistTask('Küche reinigen')).toBe(false);
    expect(isForbiddenAssistTask('Spaziergang')).toBe(false);
    expect(isForbiddenAssistTask('Kassenbon fotografieren')).toBe(false);
  });
});

describe('Assist quick-pick constants', () => {
  it('defines nicht-erledigt reasons, Tagesform and Auffälligkeiten', () => {
    expect(ASSIST_NOT_COMPLETED_REASON_KEYS).toContain('kunde_nicht_anwesend');
    expect(ASSIST_NOT_COMPLETED_REASON_KEYS).toContain('sicherheitsrisiko');
    expect(ASSIST_NOT_COMPLETED_REASON_KEYS).toContain('sonstiges');
    expect(ASSIST_TAGESFORM_KEYS).toContain('auffaellig_veraendert');
    expect(ASSIST_TAGESFORM_KEYS.length).toBe(11);
  });
});

describe('Assist package assignment (demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('adds all tasks from Standard-Alltagsbegleitung package to Werner Müller', async () => {
    const before = await fetchClientTasks(DEMO_TENANT_ID, 'client-002');
    expect(before.ok).toBe(true);
    const countBefore = before.ok ? before.data.length : 0;

    const result = await addAssistPackageToClient(
      DEMO_TENANT_ID,
      'client-002',
      'assist-pkg-standard-alltagsbegleitung',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(getAssistTasksByPackage('assist-pkg-standard-alltagsbegleitung').length);
    }

    const after = await fetchClientTasks(DEMO_TENANT_ID, 'client-002');
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.data.length).toBeGreaterThan(countBefore);
      const added = after.data.filter((t) => t.packageId === 'assist-pkg-standard-alltagsbegleitung');
      expect(added.length).toBeGreaterThan(0);
      expect(added.every((t) => t.moduleKey === 'assist')).toBe(true);
    }
  });
});
