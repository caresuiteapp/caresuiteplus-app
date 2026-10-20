import type { TaskCatalogItem } from '@/types/modules/client';

/** Vordefinierter Aufgabenkatalog für Klient:innen */
export const TASK_CATALOG: TaskCatalogItem[] = [
  { id: 'task-haushalt-1', category: 'haushalt', title: 'Staubsaugen', description: 'Wohnräume staubsaugen', defaultDurationMinutes: 30 },
  { id: 'task-haushalt-2', category: 'haushalt', title: 'Boden wischen', description: 'Küche und Bad wischen', defaultDurationMinutes: 20 },
  { id: 'task-haushalt-3', category: 'haushalt', title: 'Geschirr spülen', description: 'Geschirr abwaschen und wegräumen', defaultDurationMinutes: 15 },
  { id: 'task-waesche-1', category: 'waesche', title: 'Wäsche waschen', description: 'Wäsche in die Maschine geben', defaultDurationMinutes: 10 },
  { id: 'task-waesche-2', category: 'waesche', title: 'Wäsche aufhängen', description: 'Wäsche auf der Leine trocknen', defaultDurationMinutes: 15 },
  { id: 'task-waesche-3', category: 'waesche', title: 'Bügeln', description: 'Bügelwäsche bügeln', defaultDurationMinutes: 45 },
  { id: 'task-einkauf-1', category: 'einkauf', title: 'Lebensmitteleinkauf', description: 'Einkaufsliste abarbeiten', defaultDurationMinutes: 60 },
  { id: 'task-einkauf-2', category: 'einkauf', title: 'Apothekengang', description: 'Medikamente abholen', defaultDurationMinutes: 30 },
  { id: 'task-koerper-1', category: 'koerperpflege', title: 'Ganzkörperwäsche', description: 'Unterstützung bei der Körperpflege', defaultDurationMinutes: 45 },
  { id: 'task-koerper-2', category: 'koerperpflege', title: 'An- und Auskleiden', description: 'Hilfe beim An- und Auskleiden', defaultDurationMinutes: 20 },
  { id: 'task-mobil-1', category: 'mobilisation', title: 'Transfer Bett-Stuhl', description: 'Unterstützung beim Transfer', defaultDurationMinutes: 15 },
  { id: 'task-ernaehr-1', category: 'ernaehrung', title: 'Mahlzeit zubereiten', description: 'Warme Mahlzeit kochen', defaultDurationMinutes: 40 },
  { id: 'task-ernaehr-2', category: 'ernaehrung', title: 'Essen anreichen', description: 'Beim Essen unterstützen', defaultDurationMinutes: 30 },
  { id: 'task-med-1', category: 'medikation', title: 'Medikamentengabe', description: 'Morgenmedikation verabreichen', defaultDurationMinutes: 10 },
  { id: 'task-begleit-1', category: 'begleitung', title: 'Arztbesuch begleiten', description: 'Zum Hausarzt begleiten', defaultDurationMinutes: 90 },
  { id: 'task-begleit-2', category: 'begleitung', title: 'Spaziergang', description: 'Gemeinsamer Spaziergang', defaultDurationMinutes: 45 },
  { id: 'task-haushaltshilfe-1', category: 'haushaltshilfe', title: 'Fenster putzen', description: 'Fenster reinigen', defaultDurationMinutes: 60 },
];

export function getTasksByCategory(category: TaskCatalogItem['category']): TaskCatalogItem[] {
  return TASK_CATALOG.filter((t) => t.category === category);
}
