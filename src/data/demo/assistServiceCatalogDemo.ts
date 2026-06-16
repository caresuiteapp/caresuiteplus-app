import type { AssistServiceCatalogItem, AssistServiceTaskTemplate } from '@/types/assistServiceCatalog';
import {
  saveAssistService,
  saveServiceTaskTemplate,
} from '@/lib/assistServiceCatalog/assistServiceCatalogStore';

const BASE = '2026-06-01T10:00:00.000Z';

const DEMO_SERVICES: Array<Omit<AssistServiceCatalogItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>> = [
  {
    serviceKey: 'AB-STD',
    title: 'Alltagsbegleitung (Standard)',
    description: 'Begleitung im häuslichen Umfeld, Gespräche, Spaziergänge',
    category: 'alltagsbegleitung',
    billable: true,
    requiresSignature: false,
    requiresDocumentation: true,
    defaultDurationMinutes: 60,
    defaultTaskTemplateIds: [],
    allowedModules: ['assist'],
    taxMode: 'ustg_4_16_exempt',
    budgetEligible: true,
    status: 'active',
  },
  {
    serviceKey: 'HW-STD',
    title: 'Hauswirtschaft (Standard)',
    description: 'Unterstützung bei Reinigung, Wäsche und Mahlzeitenvorbereitung',
    category: 'hauswirtschaft',
    billable: true,
    requiresSignature: false,
    requiresDocumentation: true,
    defaultDurationMinutes: 90,
    defaultTaskTemplateIds: [],
    allowedModules: ['assist'],
    taxMode: 'ustg_4_16_exempt',
    budgetEligible: true,
    status: 'active',
  },
  {
    serviceKey: 'BT-STD',
    title: 'Betreuung (Standard)',
    description: 'Anleitung und Anregung im Alltag',
    category: 'betreuung',
    billable: true,
    requiresSignature: true,
    requiresDocumentation: true,
    defaultDurationMinutes: 60,
    defaultTaskTemplateIds: [],
    allowedModules: ['assist', 'office'],
    taxMode: 'ustg_4_16_exempt',
    budgetEligible: true,
    status: 'active',
  },
];

const DEMO_TASKS: Record<string, Array<Omit<AssistServiceTaskTemplate, 'id' | 'tenantId' | 'serviceCatalogItemId' | 'createdAt' | 'updatedAt'>>> = {
  'AB-STD': [
    { taskKey: 'anreise', title: 'Anreise und Begrüßung', description: 'Kontaktaufnahme', sortOrder: 0, isRequired: true, estimatedMinutes: 10 },
    { taskKey: 'begleitung', title: 'Begleitung im Alltag', description: 'Gespräch oder Spaziergang', sortOrder: 1, isRequired: true, estimatedMinutes: 40 },
    { taskKey: 'abschluss', title: 'Abschluss und Übergabe', description: 'Kurzprotokoll', sortOrder: 2, isRequired: true, estimatedMinutes: 10 },
  ],
  'HW-STD': [
    { taskKey: 'kueche', title: 'Küche aufräumen', description: 'Geschirr, Oberflächen', sortOrder: 0, isRequired: true, estimatedMinutes: 30 },
    { taskKey: 'waesche', title: 'Wäsche', description: 'Waschen oder falten', sortOrder: 1, isRequired: false, estimatedMinutes: 30 },
  ],
  'BT-STD': [
    { taskKey: 'gespraech', title: 'Gespräch und Anregung', description: 'Biografie, Aktivierung', sortOrder: 0, isRequired: true, estimatedMinutes: 45 },
    { taskKey: 'unterschrift', title: 'Unterschrift einholen', description: 'Leistungsnachweis', sortOrder: 1, isRequired: true, estimatedMinutes: 5 },
  ],
};

export function seedDemoAssistServiceCatalog(tenantId: string): AssistServiceCatalogItem[] {
  const seeded: AssistServiceCatalogItem[] = [];

  for (const seed of DEMO_SERVICES) {
    const serviceId = `asc-demo-${seed.serviceKey}`;
    const taskIds: string[] = [];

    for (const taskSeed of DEMO_TASKS[seed.serviceKey] ?? []) {
      const taskId = `asc-task-demo-${seed.serviceKey}-${taskSeed.taskKey}`;
      taskIds.push(taskId);
      saveServiceTaskTemplate(tenantId, {
        id: taskId,
        tenantId,
        serviceCatalogItemId: serviceId,
        ...taskSeed,
        createdAt: BASE,
        updatedAt: BASE,
      });
    }

    const service: AssistServiceCatalogItem = {
      id: serviceId,
      tenantId,
      ...seed,
      defaultTaskTemplateIds: taskIds,
      createdAt: BASE,
      updatedAt: BASE,
    };
    saveAssistService(tenantId, service);
    seeded.push(service);
  }

  return seeded;
}
