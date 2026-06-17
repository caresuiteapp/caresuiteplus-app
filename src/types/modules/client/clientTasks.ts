import type { TenantScopedEntity } from '../../core/base';
import type {
  AssistLeistungsart,
  AssistLeistungsbereichKey,
  AssistSubcategoryKey,
} from '../assist/assistTaskCatalog';

export type TaskCategory =
  | 'haushalt'
  | 'waesche'
  | 'einkauf'
  | 'koerperpflege'
  | 'mobilisation'
  | 'ernaehrung'
  | 'medikation'
  | 'begleitung'
  | 'haushaltshilfe'
  | 'sonstige';

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  haushalt: 'Haushalt',
  waesche: 'Wäsche',
  einkauf: 'Einkauf',
  koerperpflege: 'Körperpflege',
  mobilisation: 'Mobilisation',
  ernaehrung: 'Ernährung',
  medikation: 'Medikation',
  begleitung: 'Begleitung',
  haushaltshilfe: 'Haushaltshilfe',
  sonstige: 'Sonstige',
};

export type TaskFrequency = 'taeglich' | 'woechentlich' | 'zweimal_wöchentlich' | 'monatlich' | 'bei_bedarf';

export const TASK_FREQUENCY_LABELS: Record<TaskFrequency, string> = {
  taeglich: 'Täglich',
  woechentlich: 'Wöchentlich',
  zweimal_wöchentlich: '2× wöchentlich',
  monatlich: 'Monatlich',
  bei_bedarf: 'Bei Bedarf',
};

export type ClientTaskModuleKey = 'assist' | 'pflege' | 'general';

export type ClientTask = TenantScopedEntity & {
  clientId: string;
  category: TaskCategory;
  title: string;
  description: string | null;
  frequency: TaskFrequency;
  durationMinutes: number | null;
  isActive: boolean;
  catalogTaskId: string | null;
  assignedEmployeeIds: string[];
  /** CareSuite+ Assist — Modulzuordnung */
  moduleKey: ClientTaskModuleKey | null;
  leistungsbereich: AssistLeistungsbereichKey | null;
  subcategory: AssistSubcategoryKey | null;
  packageId: string | null;
  leistungsart: AssistLeistungsart | null;
  isMandatory: boolean;
  proofRequired: boolean;
  documentationRequired: boolean;
  billingRelevant: boolean;
  visibleToClient: boolean;
};

export type TaskCatalogItem = {
  id: string;
  category: TaskCategory;
  title: string;
  description: string;
  defaultDurationMinutes: number;
};
