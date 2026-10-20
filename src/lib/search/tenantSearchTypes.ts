import type { MainModuleKey } from '@/types/navigation/platform';

export type TenantSearchEntityKind =
  | 'client'
  | 'employee'
  | 'assignment'
  | 'case'
  | 'course'
  | 'communication'
  | 'office_message'
  | 'appointment'
  | 'invoice'
  | 'document'
  | 'resident'
  | 'care_plan'
  | 'trip'
  | 'execution';

export type TenantSearchResultItem = {
  id: string;
  kind: TenantSearchEntityKind;
  title: string;
  subtitle?: string;
  moduleKey: MainModuleKey;
  moduleLabel: string;
  href: string;
};

export type TenantSearchHistoryEntry = {
  query: string;
  searchedAt: string;
};

export type TenantSearchResponse = {
  query: string;
  results: TenantSearchResultItem[];
};

export const TENANT_SEARCH_ENTITY_LABELS: Record<TenantSearchEntityKind, string> = {
  client: 'Klient:in',
  employee: 'Mitarbeitende:r',
  assignment: 'Einsatz',
  case: 'Fall',
  course: 'Kurs',
  communication: 'Nachricht',
  office_message: 'Office-Nachricht',
  appointment: 'Termin',
  invoice: 'Rechnung',
  document: 'Dokument',
  resident: 'Bewohner:in',
  care_plan: 'Pflegeplan',
  trip: 'Fahrt',
  execution: 'Durchführung',
};
